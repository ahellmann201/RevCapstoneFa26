
import unittest

from tests.test_user_repository import test_user_repository
from tests.test_client_repository import test_client_repository
from tests.test_event_repository import test_event_repository
from tests.test_ball_repository import test_ball_repository
from tests.test_frame_repository import test_frame_repository
from tests.test_game_repository import test_game_repository
from tests.test_location_repository import test_location_repository
from tests.test_session_repository import test_session_repository
from tests.test_shot_repository import test_shot_repository


TESTS = [
    test_user_repository,
    test_client_repository,
    test_event_repository,
    test_ball_repository,
    test_frame_repository,
    test_game_repository,
    test_location_repository,
    test_session_repository,
    test_shot_repository,
]


def main():
    suite = unittest.TestSuite()

    for test_function in TESTS:
        suite.addTest(
            unittest.FunctionTestCase(
                test_function,
                description=test_function.__name__
            )
        )

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    if not result.wasSuccessful():
        raise SystemExit(1)


if __name__ == "__main__":
    main()
