from datetime import date
from itertools import count
from threading import Lock
from typing import Any, Optional

from .models import Project, Risk, RiskCreate, RiskUpdate

SHARED_RESPONSE_FIELDS = {
    "ResponseOwner",
    "ResponsePlan",
    "ResponseTargetDate",
    "ResponseStatus",
}
ALL_RESPONSE_FIELDS = SHARED_RESPONSE_FIELDS | {
    "TransferredTo",
    "TransferMechanism",
    "EscalatedTo",
    "AcceptanceType",
    "TriggerCondition",
    "ContingencyPlan",
    "ContingencyReserve",
}


def _relevant_fields(action: Optional[str], acceptance_type: Optional[str]) -> set[str]:
    if action in ("Avoid", "Mitigate"):
        return set(SHARED_RESPONSE_FIELDS)
    if action == "Transfer":
        return SHARED_RESPONSE_FIELDS | {"TransferredTo", "TransferMechanism"}
    if action == "Escalate":
        return SHARED_RESPONSE_FIELDS | {"EscalatedTo"}
    if action == "Accept":
        if acceptance_type == "Active":
            return SHARED_RESPONSE_FIELDS | {
                "AcceptanceType",
                "TriggerCondition",
                "ContingencyPlan",
                "ContingencyReserve",
            }
        # Passive or undecided
        return {"AcceptanceType"}
    return set()  # Ignore, or no action


def _clear_irrelevant(data: dict[str, Any]) -> dict[str, Any]:
    """Backstop the form's clear-on-switch — null fields that don't belong
    to the current tactic so they never leak into storage."""
    keep = _relevant_fields(data.get("PMOAction"), data.get("AcceptanceType"))
    for f in ALL_RESPONSE_FIELDS - keep:
        data[f] = None
    return data


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

        seed_risks: list[dict[str, Any]] = [
            # --- ERP Migration (1) ---
            {  # Avoid
                "Title": "Steering committee turnover",
                "RiskDescription": "Exec sponsor retiring mid-project.",
                "Probability": 2, "Impact": 4,
                "PMOAction": "Avoid", "RiskStatus": "Active", "ProjectID": 1,
                "ResponseOwner": "alice@kendallgroup.com",
                "ResponsePlan": "Reassign sponsorship to CFO before retirement; rewrite charter.",
                "ResponseTargetDate": date(2026, 6, 30),
                "ResponseStatus": "In Progress",
            },
            {  # Mitigate
                "Title": "Vendor delivery slips",
                "RiskDescription": "Vendor has missed two milestones; integration phase at risk.",
                "Probability": 4, "Impact": 4,
                "PMOAction": "Mitigate", "RiskStatus": "Active", "ProjectID": 1,
                "ResponseOwner": "bob@kendallgroup.com",
                "ResponsePlan": "Weekly vendor review; escalate if 2 more milestones missed.",
                "ResponseTargetDate": date(2026, 7, 15),
                "ResponseStatus": "In Progress",
            },
            {  # Mitigate (catastrophic)
                "Title": "Data migration corruption",
                "RiskDescription": "Possible loss of historical transactions in cutover.",
                "Probability": 3, "Impact": 5,
                "PMOAction": "Mitigate", "RiskStatus": "Active", "ProjectID": 1,
                "ResponseOwner": "carol@kendallgroup.com",
                "ResponsePlan": "Full backup + parallel run for 2 weeks post-cutover.",
                "ResponseTargetDate": date(2026, 8, 1),
                "ResponseStatus": "Not Started",
            },
            {  # Transfer
                "Title": "License overrun",
                "RiskDescription": "Seat count growing faster than budget.",
                "Probability": 3, "Impact": 2,
                "PMOAction": "Transfer", "RiskStatus": "Active", "ProjectID": 1,
                "ResponseOwner": "dan@kendallgroup.com",
                "ResponsePlan": "Lock pricing for 3-year term.",
                "ResponseStatus": "In Progress",
                "TransferredTo": "ERP Vendor (Acme Co.)",
                "TransferMechanism": "Contract",
            },
            {  # Accept - Active
                "Title": "User training gap",
                "RiskDescription": "Floor staff have not been onboarded to new screens.",
                "Probability": 3, "Impact": 3,
                "PMOAction": "Accept", "RiskStatus": "Monitoring", "ProjectID": 1,
                "AcceptanceType": "Active",
                "ResponseOwner": "frank@kendallgroup.com",
                "ResponsePlan": "Watch help-desk volume after cutover.",
                "ResponseStatus": "Not Started",
                "TriggerCondition": "Help-desk tickets > 10/day for 3 consecutive days",
                "ContingencyPlan": "Open office-hours sessions + place on-floor coaches.",
                "ContingencyReserve": "$15k training budget held in reserve.",
            },
            # --- CRM Rollout (2) ---
            {  # Mitigate
                "Title": "CRM data quality",
                "RiskDescription": "Account records in source system are inconsistent.",
                "Probability": 4, "Impact": 4,
                "PMOAction": "Mitigate", "RiskStatus": "Active", "ProjectID": 2,
                "ResponseOwner": "grace@kendallgroup.com",
                "ResponsePlan": "Cleanse vendor list pre-load; spot-check 5% after.",
                "ResponseTargetDate": date(2026, 7, 1),
                "ResponseStatus": "In Progress",
            },
            {  # Mitigate
                "Title": "Sales adoption",
                "RiskDescription": "Reps may resist new pipeline workflow.",
                "Probability": 3, "Impact": 3,
                "PMOAction": "Mitigate", "RiskStatus": "Active", "ProjectID": 2,
                "ResponseOwner": "heidi@kendallgroup.com",
                "ResponsePlan": "Weekly enablement + champion-rep recognition.",
                "ResponseTargetDate": date(2026, 9, 1),
                "ResponseStatus": "Not Started",
            },
            {  # Ignore
                "Title": "Coffee machine in HQ kitchen",
                "RiskDescription": "Building coffee machine flagged for service.",
                "Probability": 2, "Impact": 1,
                "PMOAction": "Ignore", "RiskStatus": "Closed", "ProjectID": 2,
            },
            # --- Warehouse Robotics Pilot (3) ---
            {  # Escalate
                "Title": "Safety incident",
                "RiskDescription": "Untested human/robot proximity scenarios.",
                "Probability": 1, "Impact": 5,
                "PMOAction": "Escalate", "RiskStatus": "Monitoring", "ProjectID": 3,
                "ResponseOwner": "eve@kendallgroup.com",
                "ResponseStatus": "In Progress",
                "EscalatedTo": "VP Operations / Safety Council",
            },
            {  # Mitigate
                "Title": "Robot calibration drift",
                "RiskDescription": "Pilot robots lose alignment over multi-shift runs.",
                "Probability": 3, "Impact": 4,
                "PMOAction": "Mitigate", "RiskStatus": "Active", "ProjectID": 3,
                "ResponseOwner": "ivan@kendallgroup.com",
                "ResponsePlan": "Add nightly calibration cycle; pause line if drift > 0.5mm.",
                "ResponseTargetDate": date(2026, 6, 15),
                "ResponseStatus": "In Progress",
            },
            {  # Accept - Passive
                "Title": "Vendor support response",
                "RiskDescription": "Vendor SLA is business-hours only.",
                "Probability": 2, "Impact": 3,
                "PMOAction": "Accept", "RiskStatus": "Active", "ProjectID": 3,
                "AcceptanceType": "Passive",
            },
        ]
        for fields in seed_risks:
            rid = next(self._risk_ids)
            data = {
                "ID": rid,
                "DateIdentified": date(2026, 4, 1),
                **fields,
            }
            self._risks[rid] = Risk(**_clear_irrelevant(data))

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
            data = payload.model_dump()
            data["ID"] = rid
            data["DateIdentified"] = date.today()
            _clear_irrelevant(data)
            risk = Risk(**data)
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
            if "ProjectID" in updates and updates["ProjectID"] not in self._projects:
                raise KeyError("ProjectID does not reference an existing project")
            _clear_irrelevant(data)
            updated = Risk(**data)
            self._risks[risk_id] = updated
            return updated


store = MockStore()
