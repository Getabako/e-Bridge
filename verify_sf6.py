
import re

def check_files():
    files = ['index.html', 'app.js']
    patterns = [r'SF6', r'Street Fighter', r'スト6']

    print("Checking for SF6 references...")
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    for pattern in patterns:
                        if re.search(pattern, line):
                            print(f"{file_path}:{i+1}: {line.strip()}")
        except FileNotFoundError:
            print(f"File not found: {file_path}")

if __name__ == "__main__":
    check_files()
