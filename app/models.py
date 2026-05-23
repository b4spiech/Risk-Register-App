from typing import Literal

from pydantic import BaseModel

ProjectStatusT = Literal["Active", "On Hold", "Completed", "Cancelled"]


class Project(BaseModel):
    ID: int
    Title: str
    ProjectStatus: ProjectStatusT
