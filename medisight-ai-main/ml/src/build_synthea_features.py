"""
Builds a real-patient feature table from the two Synthea CSV populations
(pop1 + pop2, ~30.9k patients combined), matching the exact feature schema
used by app/ml/features.py (FEATURE_NAMES) — so the resulting CSV can be
dropped straight into training in place of the 100-patient Faker dev seed.

Label (real, not heuristic):
  For each patient, pick a cutoff point at ~70% of their encounter history.
  Features are computed from everything up to that cutoff ("current picture").
  Label = 1 if the patient has an INPATIENT or EMERGENCY encounter strictly
  AFTER the cutoff, else 0. This is a genuine forward-looking prediction
  target (future acute-care utilization), not a fabricated score+noise.

Run:  python3 build_synthea_features.py
Reads directly from the two zip files, writes synthea_features.csv.
"""
import os
import pandas as pd
import numpy as np
from datetime import timedelta

POPULATIONS = {
    "pop1": r"C:\Users\ASUS\OneDrive\Desktop\HACKMATRIX 5.0\dataverse_files\synthea-patient-pop1-csv",
    "pop2": r"C:\Users\ASUS\OneDrive\Desktop\HACKMATRIX 5.0\dataverse_files\synthea-patient-pop2-csv",
}

LAB_CODES = {
    "2339-0": "glucose",        # Glucose (blood)
    "8480-6": "systolic_bp",    # Systolic BP
    "8462-4": "diastolic_bp",   # Diastolic BP
    "4548-4": "hba1c",          # HbA1c
    "18262-6": "ldl",           # LDL Cholesterol
    "2160-0": "creatinine",     # Creatinine
}
# simple reference ranges for "abnormal" flag (adult general ranges)
REF_RANGES = {
    "glucose": (70, 99),
    "systolic_bp": (90, 120),
    "diastolic_bp": (60, 80),
    "hba1c": (4.0, 5.6),
    "ldl": (0, 100),
    "creatinine": (0.6, 1.3),
}

CONDITION_KEYWORDS = {
    "has_diabetes": ["diabet"],
    "has_hypertension": ["hypertension"],
    "has_heart_disease": ["heart", "cardiac", "coronary", "myocardial"],
}


def read_csv_from_zip(dirpath, member, usecols=None, chunksize=None, parse_dates=None, dtype=None):
    path = f"{dirpath}/{member}"
    return pd.read_csv(path, usecols=usecols, chunksize=chunksize, parse_dates=parse_dates, dtype=dtype, low_memory=False)


def process_population(pop_name, zpath):
    print(f"\n=== {pop_name}: patients ===", flush=True)
    patients = read_csv_from_zip(
        zpath, "patients.csv",
        usecols=["Id", "BIRTHDATE", "GENDER"],
        parse_dates=["BIRTHDATE"],
    )
    patients = patients.rename(columns={"Id": "PATIENT"})
    print(f"  {len(patients)} patients", flush=True)

    print(f"=== {pop_name}: encounters ===", flush=True)
    enc_chunks = []
    for chunk in read_csv_from_zip(
        zpath, "encounters.csv",
        usecols=["PATIENT", "START", "ENCOUNTERCLASS"],
        chunksize=500_000,
    ):
        chunk["START"] = pd.to_datetime(chunk["START"], utc=True).dt.tz_localize(None)
        enc_chunks.append(chunk)
    encounters = pd.concat(enc_chunks, ignore_index=True)
    del enc_chunks
    print(f"  {len(encounters)} encounter rows", flush=True)

    # Sort encounters per patient, pick 70% cutoff index
    encounters = encounters.sort_values(["PATIENT", "START"])
    encounters["rank"] = encounters.groupby("PATIENT").cumcount()
    counts = encounters.groupby("PATIENT").size().rename("n_enc")
    cutoff_idx = (counts * 0.7).astype(int)
    cutoff_map = cutoff_idx.to_dict()

    def get_cutoff_date(g):
        pid = g.name
        idx = cutoff_map.get(pid, 0)
        idx = min(idx, len(g) - 1)
        return g.iloc[idx]["START"]

    print("  computing per-patient cutoff dates...", flush=True)
    as_of = encounters.groupby("PATIENT").apply(get_cutoff_date).rename("AS_OF")
    as_of = as_of.reset_index()

    enc_m = encounters.merge(as_of, on="PATIENT", how="left")
    past = enc_m[enc_m["START"] <= enc_m["AS_OF"]]
    future = enc_m[enc_m["START"] > enc_m["AS_OF"]]

    num_visits_last_year = (
        past[past["START"] > (past["AS_OF"] - pd.Timedelta(days=365))]
        .groupby("PATIENT").size().rename("num_visits_last_year")
    )

    future_acute = future[future["ENCOUNTERCLASS"].isin(["inpatient", "emergency"])]
    label = future_acute.groupby("PATIENT").size().rename("label")
    label = (label > 0).astype(int)

    del encounters, enc_m, past, future, future_acute
    print("  encounters done", flush=True)

    print(f"=== {pop_name}: conditions ===", flush=True)
    conditions = read_csv_from_zip(
        zpath, "conditions.csv",
        usecols=["PATIENT", "START", "STOP", "DESCRIPTION"],
    )
    conditions["START"] = pd.to_datetime(conditions["START"], utc=True).dt.tz_localize(None)
    conditions["STOP"] = pd.to_datetime(conditions["STOP"], utc=True).dt.tz_localize(None)
    cond_m = conditions.merge(as_of, on="PATIENT", how="inner")
    active = cond_m[
        (cond_m["START"] <= cond_m["AS_OF"]) &
        (cond_m["STOP"].isna() | (cond_m["STOP"] > cond_m["AS_OF"]))
    ].copy()
    num_active_conditions = active.groupby("PATIENT").size().rename("num_active_conditions")

    active["desc_lower"] = active["DESCRIPTION"].str.lower()
    cond_flags = {}
    for flag, keywords in CONDITION_KEYWORDS.items():
        mask = active["desc_lower"].apply(lambda d: any(k in d for k in keywords))
        cond_flags[flag] = active[mask].groupby("PATIENT").size().rename(flag)
    del conditions, cond_m
    print("  conditions done", flush=True)

    print(f"=== {pop_name}: medications ===", flush=True)
    meds = read_csv_from_zip(
        zpath, "medications.csv",
        usecols=["PATIENT", "START", "STOP"],
    )
    meds["START"] = pd.to_datetime(meds["START"], utc=True).dt.tz_localize(None)
    meds["STOP"] = pd.to_datetime(meds["STOP"], utc=True).dt.tz_localize(None)
    meds_m = meds.merge(as_of, on="PATIENT", how="inner")
    active_meds = meds_m[
        (meds_m["START"] <= meds_m["AS_OF"]) &
        (meds_m["STOP"].isna() | (meds_m["STOP"] > meds_m["AS_OF"]))
    ]
    num_prescriptions = active_meds.groupby("PATIENT").size().rename("num_prescriptions")
    del meds, meds_m, active_meds
    print("  medications done", flush=True)

    print(f"=== {pop_name}: observations (chunked, filtered) ===", flush=True)
    obs_rows = []
    for chunk in read_csv_from_zip(
        zpath, "observations.csv",
        usecols=["DATE", "PATIENT", "CODE", "VALUE"],
        chunksize=1_000_000,
        dtype={"CODE": str},
    ):
        sub = chunk[chunk["CODE"].isin(LAB_CODES.keys())].copy()
        if len(sub):
            sub["VALUE"] = pd.to_numeric(sub["VALUE"], errors="coerce")
            sub = sub.dropna(subset=["VALUE"])
            sub["DATE"] = pd.to_datetime(sub["DATE"], utc=True).dt.tz_localize(None)
            obs_rows.append(sub)
    obs = pd.concat(obs_rows, ignore_index=True) if obs_rows else pd.DataFrame(columns=["DATE", "PATIENT", "CODE", "VALUE"])
    del obs_rows
    print(f"  {len(obs)} relevant lab/vital rows", flush=True)

    obs_m = obs.merge(as_of, on="PATIENT", how="inner")
    obs_past = obs_m[obs_m["DATE"] <= obs_m["AS_OF"]].copy()
    obs_past["lab_name"] = obs_past["CODE"].map(LAB_CODES)

    # latest value per patient per lab
    obs_past = obs_past.sort_values(["PATIENT", "lab_name", "DATE"])
    latest = obs_past.groupby(["PATIENT", "lab_name"]).last().reset_index()
    latest_glucose = latest[latest["lab_name"] == "glucose"].set_index("PATIENT")["VALUE"].rename("latest_glucose")
    latest_sbp = latest[latest["lab_name"] == "systolic_bp"].set_index("PATIENT")["VALUE"].rename("latest_systolic_bp")

    def is_abnormal(row):
        lo, hi = REF_RANGES.get(row["lab_name"], (None, None))
        if lo is None:
            return False
        return row["VALUE"] < lo or row["VALUE"] > hi

    obs_past["abnormal"] = obs_past.apply(is_abnormal, axis=1)
    lab_stats = obs_past.groupby("PATIENT")["abnormal"].agg(["sum", "count"])
    abnormal_lab_ratio = (lab_stats["sum"] / lab_stats["count"]).rename("abnormal_lab_ratio")
    del obs, obs_m, obs_past, latest
    print("  observations done", flush=True)

    # ---- assemble ----
    df = patients.set_index("PATIENT")
    df = df.join(as_of.set_index("PATIENT")["AS_OF"], how="inner")
    df = df.join(num_visits_last_year, how="left")
    df = df.join(num_active_conditions, how="left")
    for flag, series in cond_flags.items():
        df = df.join(series, how="left")
    df = df.join(num_prescriptions, how="left")
    df = df.join(latest_glucose, how="left")
    df = df.join(latest_sbp, how="left")
    df = df.join(abnormal_lab_ratio, how="left")
    df = df.join(label, how="left")

    df["age"] = ((df["AS_OF"] - df["BIRTHDATE"]).dt.days / 365.25)
    df["is_male"] = df["GENDER"].str.upper().eq("M").astype(float)
    for col in ["num_visits_last_year", "num_active_conditions", "num_prescriptions",
                "has_diabetes", "has_hypertension", "has_heart_disease"]:
        df[col] = df[col].fillna(0)
    df["has_diabetes"] = (df["has_diabetes"] > 0).astype(float)
    df["has_hypertension"] = (df["has_hypertension"] > 0).astype(float)
    df["has_heart_disease"] = (df["has_heart_disease"] > 0).astype(float)
    df["latest_glucose"] = df["latest_glucose"].fillna(90.0)
    df["latest_systolic_bp"] = df["latest_systolic_bp"].fillna(120.0)
    df["abnormal_lab_ratio"] = df["abnormal_lab_ratio"].fillna(0.0)
    df["label"] = df["label"].fillna(0).astype(int)
    df["age"] = df["age"].clip(lower=0)
    df = df[df["age"] >= 1]  # drop bad rows

    df["population"] = pop_name
    keep = ["age", "is_male", "num_active_conditions", "num_visits_last_year",
            "num_prescriptions", "abnormal_lab_ratio", "has_diabetes",
            "has_hypertension", "has_heart_disease", "latest_glucose",
            "latest_systolic_bp", "label", "population"]
    out = df[keep].reset_index()
    print(f"  {pop_name}: assembled {len(out)} feature rows, "
          f"{out['label'].sum()} positive", flush=True)
    return out


if __name__ == "__main__":
    all_frames = []
    for name, path in POPULATIONS.items():
        all_frames.append(process_population(name, path))
    full = pd.concat(all_frames, ignore_index=True)
    OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "data",
    "synthea_features.csv"
)

full.to_csv(OUTPUT_PATH, index=False)
print(
    f"\nTOTAL: {len(full)} patients, " 
    f"{full['label'].sum()} positive "
    f"({100*full['label'].mean():.1f}%)"
)
