# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import json
from typing import Any

class JSONWithCommentsDecoder(json.JSONDecoder):
  def __init__(self, **kw):
    super().__init__(**kw)

  def decode(self, s: str) -> Any:
    s = '\n'.join(l for l in s.split('\n') if not l.lstrip(' ').startswith('//'))
    return super().decode(s)
