import requests
import random

JAR_ENTRY_TEMPLATE = "\tcontent/browser/zen-avatars/{}\t(content/zen-avatars/{})"
URL = "https://source.boringavatars.com/beam/120/${}?colors=fac89a,e290ff"

def random_string(length):
  return ''.join(random.choices("abcdefghijklmnopqrstuvwxyz", k=length))

def generate_list_names():
  names = []
  for i in range(1, 101):
    names.append(random_string(random.randint(5, 10)))
  return names

def write_jar_file(jar_file):
  with open("jar.inc.mn", "w") as f:
    f.write(jar_file)    

def fetch_all_avatars():
  names = generate_list_names()
  jar_file = ""
  for [i, name] in enumerate(names):
    url = URL.format(name)
    response = requests.get(url)
    with open(f"avatar-{i}.svg", "w") as f:
      f.write(response.text)
    jar_file += JAR_ENTRY_TEMPLATE.format(f"avatar-{i}.svg", f"avatar-{i}.svg") + "\n"
    print(f"SUCCESS: Fetched 'avatar-{i}.svg' with name '{name}'")
  write_jar_file(jar_file)

def main():
  fetch_all_avatars()

if __name__ == "__main__":
  main()
