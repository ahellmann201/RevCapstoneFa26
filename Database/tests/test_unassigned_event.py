"""Hidden event creation uses the authenticated owner and reuses existing rows."""
from contextlib import contextmanager
from unittest.mock import MagicMock


def test_unassigned_event_reuses_existing_record(modules, user, monkeypatch):
    bowling = modules[3]
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(user.user_id,), (91,)]

    @contextmanager
    def transaction(write=False):
        assert write
        yield cursor

    monkeypatch.setattr(bowling, "database_cursor", transaction)
    assert bowling.unassigned_event(user) == {"event_id": 91}
    assert not any("INSERT INTO" in call.args[0] for call in cursor.execute.call_args_list)
    assert cursor.execute.call_args_list[1].args[1] == (user.user_id, "SystemUnassigned")


def test_unassigned_event_creates_for_current_user(modules, user, monkeypatch):
    bowling = modules[3]
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(user.user_id,), None, (92,)]

    @contextmanager
    def transaction(write=False):
        assert write
        yield cursor

    monkeypatch.setattr(bowling, "database_cursor", transaction)
    assert bowling.unassigned_event(user) == {"event_id": 92}
    assert cursor.execute.call_args.args[1] == (user.user_id, "Unassigned Games", "SystemUnassigned", False)
