import os
import re

def find_finnish_text(root_dir):
    finnish_patterns = [
        r'//.*[äöÄÖ]',  # JavaScript/TypeScript comments
        r'#.*[äöÄÖ]',  # Python comments
        r'"[^"]*[äöÄÖ][^"]*"',  # Strings with Finnish characters
        r"'[^']*[äöÄÖ][^']*'",  # Same with single quotes
    ]
    
    report = []
    
    for subdir, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith((".ts", ".js", ".py", ".md", ".sh")):
                file_path = os.path.join(subdir, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        
                    for i, line in enumerate(lines, 1):
                        if any(re.search(pattern, line) for pattern in finnish_patterns):
                            report.append(f"{file_path}:{i}: {line.strip()}")
                except Exception as e:
                    report.append(f"Error reading {file_path}: {str(e)}")
    
    return report

def save_report(report, output_file="finnish_content_report.txt"):
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("Finnish text found in the following files:\n\n")
        f.write("\n".join(report))
    print(f"Report saved to {output_file}")

if __name__ == "__main__":
    project_root = "."  # Change path if your project is in a different directory
    report = find_finnish_text(project_root)
    
    if report:
        save_report(report)
        print(f"Finnish content detected! Found {len(report)} instances. Check 'finnish_content_report.txt' for details.")
    else:
        print("No Finnish content found.")
