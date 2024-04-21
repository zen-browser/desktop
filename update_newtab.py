import os

def update_newtab(init: bool = True):
  if init:
    os.system("(cd ./engine/browser/components/newtab && ../../../mach npm install && ../../../mach npm install meow@9.0.0)")
  os.system("cd ./engine && ./mach npm run bundle --prefix=browser/components/newtab")

if __name__ == "__main__":
  update_newtab(False)
