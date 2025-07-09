
import os
import requests
import json


def get_emojis(url):
  """
  Fetches emojis from the given URL and formats them into a JavaScript module.

  Args:
      url (str): The URL to fetch the emoji data from.

  Returns:
      array: A JavaScript array of emoji objects formatted for use in a module.
  """
  response = requests.get(url)
  response.raise_for_status()  # Raise an error for bad responses
  emojis_data = response.json()

  # We only want "tags", "emoji" amd "order" from the dictionaries inside this array
  emojis = []
  for emoji in emojis_data:
    emojis.append({
        "tags": emoji.get("tags", []),
        "order": emoji.get("order", 0),
        "emoji": emoji.get("emoji", "")
    })
  return emojis


def get_js_code(emojis):
  """
  Generates JavaScript code to export the emojis as a module.

  Args:
      emojis (list): A list of emoji dictionaries.

  Returns:
      str: JavaScript code as a string.
  """
  js_code = "var ZenEmojisData = "
  # dump without unicode escape
  js_code += json.dumps(emojis, ensure_ascii=False)
  return js_code


if __name__ == "__main__":
  # Define the URL for the emoji JSON file
  url = "https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1/en/emojibase/data.json"
  emojis_path = os.path.join(os.path.dirname(__file__), "ZenEmojisData.min.mjs")
  emojis = get_emojis(url)
  js_code = get_js_code(emojis)
  with open(emojis_path, "w", encoding="utf-8") as file:
    file.write(js_code)
  print(f"Emojis data has been written to {emojis_path}")
