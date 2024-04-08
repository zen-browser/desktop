
import os

def initialize_avatars():
  os.system("cd src/browser/base/content/zen-avatars && python3 fetch-all-avatars.py")

def recompile_new_tab():
  os.system("(cd ./engine/browser/components/newtab && ../../../mach npm install && ../../../mach npm install meow@9.0.0)")
  os.system("cd ./engine && ./mach npm run bundle --prefix=browser/components/newtab")

def main():
  initialize_avatars()
  recompile_new_tab()

if __name__ == "__main__":
  main()