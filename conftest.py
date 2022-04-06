import os
import sys
from collections import OrderedDict

import pytest

pytest_plugins = ["sentry.utils.pytest"]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def pytest_configure(config):
    import warnings

    # XXX(dcramer): Kombu throws a warning due to transaction.commit_manually
    # being used
    warnings.filterwarnings("error", "", Warning, r"^(?!(|kombu|raven|sentry))")


def enable_file_tracking():
    import builtins
    import socket
    import traceback
    import weakref

    from _pytest import unraisableexception

    original_open = open
    original_socket = socket.socket
    handle_stacks = {}

    class patched_catch_unraisable_exception(unraisableexception.catch_unraisable_exception):
        def _hook(self, ur):
            super()._hook(ur)
            try:
                stack, handle_repr = handle_stacks[ur.object.fileno()]
            except Exception:
                return

            for idx, line in enumerate(stack):
                if "pytest_runtest_call" in line:
                    stack = stack[idx + 1 :]
                    break

            if stack:
                sys.stderr.write(f"\n\nHandle {handle_repr} Traceback (most recent call last):\n")
                sys.stderr.write("".join(stack))

    unraisableexception.catch_unraisable_exception = patched_catch_unraisable_exception

    def _track_handle(handle):
        def on_collect(val):
            handle_stacks.pop(val.fileno(), None)

        handle_stacks[handle.fileno()] = (traceback.format_stack(sys._getframe(2)), repr(handle))
        weakref.ref(handle, on_collect)

    def _open(*args, **kwargs):
        handle = original_open(*args, **kwargs)
        _track_handle(handle)
        return handle

    def _socket(*args, **kwargs):
        handle = original_socket(*args, **kwargs)
        _track_handle(handle)
        return handle

    builtins.open = _open
    socket.socket = _socket


if os.environ.get("SENTRY_TEST_TRACK_FILES") == "1":
    enable_file_tracking()


# XXX: The below code is vendored code from https://github.com/utgwkk/pytest-github-actions-annotate-failures
# so that we can add support for pytest_rerunfailures
# retried tests will no longer be annotated in GHA
#
# Reference:
# https://docs.pytest.org/en/latest/writing_plugins.html#hookwrapper-executing-around-other-hooks
# https://docs.pytest.org/en/latest/writing_plugins.html#hook-function-ordering-call-example
# https://docs.pytest.org/en/stable/reference.html#pytest.hookspec.pytest_runtest_makereport
#
# Inspired by:
# https://github.com/pytest-dev/pytest/blob/master/src/_pytest/terminal.py


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    # execute all other hooks to obtain the report object
    outcome = yield
    report = outcome.get_result()

    # enable only in a workflow of GitHub Actions
    # ref: https://help.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return

    # If we have the pytest_rerunfailures plugin,
    # and there are still retries to be run,
    # then do not return the error
    if hasattr(item, "execution_count"):
        import pytest_rerunfailures

        if item.execution_count <= pytest_rerunfailures.get_reruns_count(item):
            return

    if report.when == "call" and report.failed:
        # collect information to be annotated
        filesystempath, lineno, _ = report.location

        # try to convert to absolute path in GitHub Actions
        workspace = os.environ.get("GITHUB_WORKSPACE")
        if workspace:
            full_path = os.path.abspath(filesystempath)
            try:
                rel_path = os.path.relpath(full_path, workspace)
            except ValueError:
                # os.path.relpath() will raise ValueError on Windows
                # when full_path and workspace have different mount points.
                # https://github.com/utgwkk/pytest-github-actions-annotate-failures/issues/20
                rel_path = filesystempath
            if not rel_path.startswith(".."):
                filesystempath = rel_path

        if lineno is not None:
            # 0-index to 1-index
            lineno += 1

        # get the name of the current failed test, with parametrize info
        longrepr = report.head_line or item.name

        # get the error message and line number from the actual error
        try:
            longrepr += "\n\n" + report.longrepr.reprcrash.message
            lineno = report.longrepr.reprcrash.lineno
        except AttributeError:
            pass

        print(_error_workflow_command(filesystempath, lineno, longrepr))  # noqa: B314


def _error_workflow_command(filesystempath, lineno, longrepr):
    # Build collection of arguments. Ordering is strict for easy testing
    details_dict = OrderedDict()
    details_dict["file"] = filesystempath
    if lineno is not None:
        details_dict["line"] = lineno

    details = ",".join(f"{k}={v}" for k, v in details_dict.items())

    if longrepr is None:
        return f"\n::error {details}"
    else:
        longrepr = _escape(longrepr)
        return f"\n::error {details}::{longrepr}"


def _escape(s):
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
