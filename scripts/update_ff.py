
import os
import json

last_version = "0.0.0"
new_version = "0.0.0"

def update_ff():
  os.system("npm run update-ff:raw")

def get_version_before():
  global last_version
  with open("surfer.json", "r") as f:
    data = json.load(f)
    last_version = data["version"]["version"]

def get_version_after():
  global new_version
  with open("surfer.json", "r") as f:
    data = json.load(f)
    new_version = data["version"]["version"]

def update_readme():
  global last_version
  global new_version
  with open("README.md", "r") as f:
    data = f.read()
    data = data.replace(last_version, new_version)
  with open("README.md", "w") as f:
    f.write(data)

if __name__ == "__main__":
  get_version_before()
  update_ff()
  get_version_after()
  update_readme()
  print("Updated from version {} to version {}".format(last_version, new_version))    
