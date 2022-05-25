from sentry.rules import rules
from sentry.utils.imports import import_submodules

from .actions import MsTeamsNotifyServiceAction

import_submodules(globals(), __name__, __path__)

rules.add(MsTeamsNotifyServiceAction)
