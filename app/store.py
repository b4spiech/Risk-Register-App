from itertools import count
from threading import Lock
from typing import Optional

from .models import Project


class MockStore:
    """In-memory project list used only by the /api/projects fallback
    path when Get_Projects_URL isn't set. Risks live entirely in
    SharePoint — the app holds no local risk data."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._projects: dict[int, Project] = {}
        self._project_ids = count(1)
        self._seed()

    def _seed(self) -> None:
        seed_projects = [
            ("ERP Migration", "Active"),
            ("CRM Rollout", "Active"),
            ("Warehouse Robotics Pilot", "Active"),
            ("Legacy Mainframe Sunset", "On Hold"),
            ("Annual Audit Prep", "Completed"),
        ]
        for title, status in seed_projects:
            pid = next(self._project_ids)
            self._projects[pid] = Project(ID=pid, Title=title, ProjectStatus=status)

    def list_projects(self, status: Optional[str] = None) -> list[Project]:
        with self._lock:
            items = list(self._projects.values())
        if status:
            items = [p for p in items if p.ProjectStatus == status]
        return items


store = MockStore()
