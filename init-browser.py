
import os
from update_newtab import update_newtab

def initialize_avatars():
  os.system("cd src/browser/base/content/zen-avatars && python3 fetch-all-avatars.py")

def main():
  initialize_avatars()
  update_newtab()

if __name__ == "__main__":
  main()