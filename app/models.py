from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

ProjectStatusT = Literal["Active", "On Hold", "Complete", "Cancelled"]
PMOActionT = Literal["Avoid", "Mitigate", "Transfer", "Escalate", "Accept", "Ignore"]
RiskStatusT = Literal["Active", "Monitoring", "Closed"]
ResponseStatusT = Literal["Not Started", "In Progress", "Complete"]
TransferMechanismT = Literal["Insurance", "Bond", "Contract", "Warranty", "Other"]
AcceptanceTypeT = Literal["Passive", "Active"]


class Project(BaseModel):
    ID: int
    Title: str
    ProjectStatus: ProjectStatusT


class Risk(BaseModel):
    ID: int
    Title: str
    RiskDescription: str
    Probability: int = Field(ge=1, le=5)
    Impact: int = Field(ge=1, le=5)
    PMOAction: PMOActionT
    RiskStatus: RiskStatusT
    ProjectID: int
    DateIdentified: date
    # Adaptive response fields. All optional at the schema level; the app
    # enforces per-tactic required-ness. SharePoint columns also stay
    # nullable so other tactics can omit them.
    ResponseOwner: Optional[EmailStr] = None
    ResponsePlan: Optional[str] = None
    ResponseTargetDate: Optional[date] = None
    ResponseStatus: Optional[ResponseStatusT] = None
    TransferredTo: Optional[str] = None
    TransferMechanism: Optional[TransferMechanismT] = None
    EscalatedTo: Optional[str] = None
    AcceptanceType: Optional[AcceptanceTypeT] = None
    TriggerCondition: Optional[str] = None
    ContingencyPlan: Optional[str] = None
    ContingencyReserve: Optional[str] = None


class RiskCreate(BaseModel):
    Title: str
    RiskDescription: str
    Probability: int = Field(ge=1, le=5)
    Impact: int = Field(ge=1, le=5)
    PMOAction: PMOActionT
    RiskStatus: RiskStatusT = "Active"
    ProjectID: int
    ResponseOwner: Optional[EmailStr] = None
    ResponsePlan: Optional[str] = None
    ResponseTargetDate: Optional[date] = None
    ResponseStatus: Optional[ResponseStatusT] = None
    TransferredTo: Optional[str] = None
    TransferMechanism: Optional[TransferMechanismT] = None
    EscalatedTo: Optional[str] = None
    AcceptanceType: Optional[AcceptanceTypeT] = None
    TriggerCondition: Optional[str] = None
    ContingencyPlan: Optional[str] = None
    ContingencyReserve: Optional[str] = None


class RiskUpdate(BaseModel):
    Title: Optional[str] = None
    RiskDescription: Optional[str] = None
    Probability: Optional[int] = Field(default=None, ge=1, le=5)
    Impact: Optional[int] = Field(default=None, ge=1, le=5)
    PMOAction: Optional[PMOActionT] = None
    RiskStatus: Optional[RiskStatusT] = None
    ProjectID: Optional[int] = None
    ResponseOwner: Optional[EmailStr] = None
    ResponsePlan: Optional[str] = None
    ResponseTargetDate: Optional[date] = None
    ResponseStatus: Optional[ResponseStatusT] = None
    TransferredTo: Optional[str] = None
    TransferMechanism: Optional[TransferMechanismT] = None
    EscalatedTo: Optional[str] = None
    AcceptanceType: Optional[AcceptanceTypeT] = None
    TriggerCondition: Optional[str] = None
    ContingencyPlan: Optional[str] = None
    ContingencyReserve: Optional[str] = None
