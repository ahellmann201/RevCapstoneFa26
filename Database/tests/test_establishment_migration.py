from unittest.mock import MagicMock

import pytest

from Database.scripts.migrate_establishments import migrate


def test_migration_adds_missing_columns_and_commits():
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.side_effect = [(123,), (None,), (100,), (50,), (1,), (1,)]
    assert migrate(connection) == ["nickname"]
    connection.commit.assert_called_once()
    connection.rollback.assert_not_called()
    cursor.close.assert_called_once()


def test_already_current_migration_has_no_alter():
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = (1,)
    assert migrate(connection) == []
    assert not any("ALTER TABLE" in call.args[0] for call in cursor.execute.call_args_list)


def test_failed_migration_rolls_back():
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = (None,)
    with pytest.raises(RuntimeError):
        migrate(connection)
    connection.commit.assert_not_called()
    connection.rollback.assert_called_once()
    cursor.close.assert_called_once()
