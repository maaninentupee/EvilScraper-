import os
import re

def has_finnish_content(line, patterns):
    """Check if a line contains Finnish text using the given patterns."""
    return any(re.search(pattern, line) for pattern in patterns)

def process_file(file_path, patterns):
    """Process a single file and return lines containing Finnish text."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        
        return [
            f"{file_path}:{i}: {line.strip()}"
            for i, line in enumerate(lines, 1)
            if has_finnish_content(line, patterns)
        ]
    except Exception as e:
        return [f"Error reading {file_path}: {str(e)}"]

def get_target_files(root_dir, target_extensions):
    """Get all files with target extensions from the directory."""
    matching_files = []
    for subdir, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith(target_extensions):
                matching_files.append(os.path.join(subdir, file))
    return matching_files

def find_finnish_text(root_dir):
    """Find Finnish text in files under the given directory."""
    finnish_patterns = [
        r'//.*[äöÄÖ]',  # JavaScript/TypeScript comments
        r'#.*[äöÄÖ]',  # Python comments
        r'"[^"]*[äöÄÖ][^"]*"',  # Strings with Finnish characters
        r"'[^']*[äöÄÖ][^']*'",  # Same with single quotes
    ]
    
    target_extensions = (".ts", ".js", ".py", ".md", ".sh")
    
    # Get matching files
    files = get_target_files(root_dir, target_extensions)
    
    # Process files and collect results
    results = []
    for file_path in files:
        results.extend(process_file(file_path, finnish_patterns))
    
    return results

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
