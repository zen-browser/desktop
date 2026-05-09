# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

cargo = os.environ.get('CARGO', 'cargo')

command = [cargo] + sys.argv[1:]

try:
  os.execvp(command[0], command)
except OSError as e:
  print(f"{sys.argv[0]}: '{command[0]}': {e}", file=sys.stderr)
  if 'CARGO' in os.environ:
    print('(CARGO environment variable is set)', file=sys.stderr)
  sys.exit(1)
