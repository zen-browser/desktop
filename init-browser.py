
import os

def initialize_avatars():
  os.system("cd src/browser/base/content/zen-avatars && python3 fetch-all-avatars.py")

def main():
  initialize_avatars()

if __name__ == "__main__":
  main()