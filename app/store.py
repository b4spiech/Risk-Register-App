from datetime import date
from itertools import count
from threading import Lock
from typing import Optional

from .models import Project, Risk, RiskCreate, RiskUpdate


class MockStore:
    """In-memory store shaped like the two SharePoint lists.

    Swap this for a Microsoft Graph client later — the route handlers
    only call the public methods on this class.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._projects: dict[int, Project] = {}
        self._risks: dict[int, Risk] = {}
        self._project_ids = count(1)
        self._risk_ids = count(1)
        self._seed()

    def _seed(self) -> None:
        seed_projects = [
            ("ERP Migration", "Active"),
            ("CRM Rollout", "Active"),
            ("Warehouse Robotics Pilot", "Active"),
            ("Legacy Mainframe Sunset", "On Hold"),
            ("Annual Audit Prep", "Complete"),
        ]
        for title, status in seed_projects:
            pid = next(self._project_ids)
            self._projects[pid] = Project(ID=pid, Title=title, ProjectStatus=status)

        seed_risks: list[tuple[str, str, int, int, str, Optional[str], str, int]] = [
            ("Vendor delivery slips", "Vendor has missed two milestones; integration phase at risk.", 4, 4, "Mitigate", "alice@kendallgroup.com", "Active", 1),
            ("Data migration corruption", "Possible loss of historical transactions in cutover.", 3, 5, "Mitigate", "bob@kendallgroup.com", "Active", 1),
            ("User training gap", "Floor staff have not been onboarded to new screens.", 3, 3, "Mitigate", "carol@kendallgroup.com", "Monitoring", 1),
            ("Network bandwidth", "WAN may not handle batch sync windows.", 2, 4, "Accept", None, "Active", 1),
            ("Scope creep", "Stakeholders adding modules mid-build.", 4, 3, "Mitigate", "dan@kendallgroup.com", "Active", 1),
            ("Steering committee turnover", "Exec sponsor retiring mid-project.", 2, 2, "Ignore", None, "Closed", 1),
            ("CRM data quality", "Account records in source system are inconsistent.", 4, 4, "Mitigate", "eve@kendallgroup.com", "Active", 2),
            ("Sales adoption", "Reps may resist new pipeline workflow.", 3, 3, "Mitigate", "frank@kendallgroup.com", "Monitoring", 2),
            ("Integration with ERP", "Two-way sync untested at production volume.", 2, 5, "Mitigate", "grace@kendallgroup.com", "Active", 2),
            ("License overrun", "Seat count growing faster than budget.", 3, 2, "Accept", None, "Active", 2),
            ("Robot calibration drift", "Pilot robots lose alignment over multi-shift runs.", 3, 4, "Mitigate", "heidi@kendallgroup.com", "Active", 3),
            ("Safety incident", "Untested human/robot proximity scenarios.", 1, 5, "Mitigate", "ivan@kendallgroup.com", "Monitoring", 3),
            ("Vendor support response", "Vendor SLA is business-hours only.", 2, 3, "Accept", None, "Active", 3),
        ]
        for title, desc, prob, impact, action, owner, status, project_id in seed_risks:
            rid = next(self._risk_ids)
            self._risks[rid] = Risk(
                ID=rid,
                Title=title,
                RiskDescription=desc,
                Probability=prob,
                Impact=impact,
                PMOAction=action,
                RiskOwner=owner,
                RiskStatus=status,
                ProjectID=project_id,
                DateIdentified=date(2026, 4, 1),
            )

    def list_projects(self, status: Optional[str] = None) -> list[Project]:
        with self._lock:
            items = list(self._projects.values())
        if status:
            items = [p for p in items if p.ProjectStatus == status]
        return items

    def list_risks(self, project_id: Optional[int] = None) -> list[Risk]:
        with self._lock:
            items = list(self._risks.values())
        if project_id is not None:
            items = [r for r in items if r.ProjectID == project_id]
        return items

    def get_risk(self, risk_id: int) -> Optional[Risk]:
        with self._lock:
            return self._risks.get(risk_id)

    def create_risk(self, payload: RiskCreate) -> Risk:
        with self._lock:
            if payload.ProjectID not in self._projects:
                raise KeyError("ProjectID does not reference an existing project")
            rid = next(self._risk_ids)
            risk = Risk(
                ID=rid,
                Title=payload.Title,
                RiskDescription=payload.RiskDescription,
                Probability=payload.Probability,
                Impact=payload.Impact,
                PMOAction=payload.PMOAction,
                RiskOwner=payload.RiskOwner if payload.PMOAction == "Mitigate" else None,
                RiskStatus=payload.RiskStatus,
                ProjectID=payload.ProjectID,
                DateIdentified=date.today(),
            )
            self._risks[rid] = risk
            return risk

    def update_risk(self, risk_id: int, payload: RiskUpdate) -> Optional[Risk]:
        with self._lock:
            current = self._risks.get(risk_id)
            if current is None:
                return None
            data = current.model_dump()
            updates = payload.model_dump(exclude_unset=True)
            data.update(updates)
            if data.get("PMOAction") != "Mitigate":
                data["RiskOwner"] = None
            if "ProjectID" in updates and updates["ProjectID"] not in self._projects:
                raise KeyError("ProjectID does not reference an existing project")
            updated = Risk(**data)
            self._risks[risk_id] = updated
            return updated


store = MockStore()
