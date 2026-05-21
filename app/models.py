from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

ProjectStatusT = Literal["Active", "On Hold", "Complete", "Cancelled"]
PMOActionT = Literal["Accept", "Mitigate", "Ignore"]
RiskStatusT = Literal["Active", "Monitoring", "Closed"]


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
    RiskOwner: Optional[EmailStr] = None
    RiskStatus: RiskStatusT
    ProjectID: int
    DateIdentified: date


class RiskCreate(BaseModel):
    Title: str
    RiskDescription: str
    Probability: int = Field(ge=1, le=5)
    Impact: int = Field(ge=1, le=5)
    PMOAction: PMOActionT
    RiskOwner: Optional[EmailStr] = None
    RiskStatus: RiskStatusT = "Active"
    ProjectID: int


class RiskUpdate(BaseModel):
    Title: Optional[str] = None
    RiskDescription: Optional[str] = None
    Probability: Optional[int] = Field(default=None, ge=1, le=5)
    Impact: Optional[int] = Field(default=None, ge=1, le=5)
    PMOAction: Optional[PMOActionT] = None
    RiskOwner: Optional[EmailStr] = None
    RiskStatus: Optional[RiskStatusT] = None
    ProjectID: Optional[int] = None
