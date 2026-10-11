from datetime import date
from pydantic import BaseModel, ConfigDict, Field


class VisitCreate(BaseModel):
    visit_date: date
    reason: str = Field(min_length=1, max_length=255)
    notes: str = ""


class ConditionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    icd10_code: str = ""
    diagnosed_date: date
    active: bool = True


class LabResultCreate(BaseModel):
    test_name: str = Field(min_length=1, max_length=128)
    value: float
    unit: str = ""
    reference_range: str = ""
    result_date: date
    abnormal: bool = False


class PrescriptionCreate(BaseModel):
    medication: str = Field(min_length=1, max_length=128)
    dosage: str = ""
    frequency: str = ""
    start_date: date
    end_date: date | None = None


class VisitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    visit_date: date
    reason: str
    notes: str


class ConditionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    icd10_code: str
    diagnosed_date: date
    active: bool


class LabResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    test_name: str
    value: float
    unit: str
    reference_range: str
    result_date: date
    abnormal: bool


class PrescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    medication: str
    dosage: str
    frequency: str
    start_date: date
    end_date: date | None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_ref: str
    age: int
    gender: str
    region: str
    blood_group: str | None = None
    blood_group_verified: bool = False
    access_scope: str | None = None


class PatientDetailOut(PatientOut):
    conditions: list[ConditionOut] = []
    visits: list[VisitOut] = []
    lab_results: list[LabResultOut] = []
    prescriptions: list[PrescriptionOut] = []
