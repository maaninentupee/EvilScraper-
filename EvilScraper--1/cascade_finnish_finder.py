import os
import re

# Directory where Finnish text is searched for
PROJECT_DIR = os.getcwd()

# Finnish characters and more specific Finnish words
FINNISH_CHARS = 'äöÄÖ'
FINNISH_WORDS = [
    "virheellinen", "pyyntö", "syöte", "käytettävissä", "palveluntarjoaja",
    "määrä", "välillä", "yritä", "myöhemmin", "uudelleen", "tarkista",
    "sisältösuodatin", "kontekstin", "pituus", "ylittää", "rajat",
    "epäonnistui", "aikakatkaistiin", "palvelin", "vastannut", "ajoissa",
    "järjestelmävirhe", "päätöksenteossa", "syötteet", "pakollisia", "samanaikaisten",
    "virhe", "päätöksenteossa", "palveluntarjoajaa", "kelvollisia", "merkkijonoja",
    "olet", "asiantuntija", "auttaa", "luomaan", "laadukasta", "sisältöä",
    "päätöksenteon", "analysoimaan", "vaihtoehtoja", "tekemään", "perusteltuja",
    "päätöksiä", "avulias", "tekoälyassistentti", "vastaa", "kysymyksiin",
    "selkeästi", "tarkasti"
]

# Regular expressions for detecting Finnish text
FINNISH_PATTERNS = [
    r'//.*[{}]'.format(FINNISH_CHARS),  # JavaScript/TypeScript comments with Finnish chars
    r'#.*[{}]'.format(FINNISH_CHARS),   # Python comments with Finnish chars
    r'"[^"]*[{}][^"]*"'.format(FINNISH_CHARS),  # Strings with Finnish characters
    r"'[^']*[{}][^']*'".format(FINNISH_CHARS),  # Same with single quotes
    r'\b(?:' + '|'.join(FINNISH_WORDS) + r')\b'  # Specific Finnish words
]

# Combine all patterns
FINNISH_REGEX = re.compile('|'.join(FINNISH_PATTERNS), re.IGNORECASE)

# Paths to exclude (node_modules, dist, etc.)
EXCLUDE_PATHS = [
    'node_modules',
    '.git',
    'test/results',
    'cascade_finnish_finder.py',
    'finnish_finder.py',
    'cascade_finnish_report.txt',
    'finnish_content_report.txt'
]

def should_exclude(path):
    """Check if the path should be excluded from scanning."""
    for exclude in EXCLUDE_PATHS:
        if exclude in path:
            return True
    return False

def find_finnish_in_file(file_path):
    """Identify Finnish words and comments in a file."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            lines = file.readlines()
        
        finnish_lines = []
        for i, line in enumerate(lines, start=1):
            if FINNISH_REGEX.search(line):
                finnish_lines.append((i, line.strip()))

        return finnish_lines
    except Exception as e:
        return [(0, f"Error reading file: {str(e)}")]

def write_report_header(report):
    """Write the initial report header."""
    report.write("Finnish Content Report\n")
    report.write("=" * 50 + "\n\n")
    report.write("This report shows files containing Finnish text that needs translation.\n\n")

def process_finnish_findings(report, finnish_lines, file_path):
    """Process and write findings for a single file."""
    report.write(f"\nFile: {file_path}\n")
    report.write("-" * 50 + "\n")
    for line_num, text in finnish_lines:
        report.write(f"{line_num}: {text}\n")
    return len(finnish_lines)

def scan_dist_directory(report, dist_dir):
    """Scan the dist directory for Finnish content."""
    total_found = 0
    files_with_finnish = 0
    
    report.write("Scanning dist directory for Finnish content...\n\n")
    
    for root, _, files in os.walk(dist_dir):
        for file in files:
            if not file.endswith('.js'):
                continue
                
            file_path = os.path.join(root, file)
            finnish_lines = find_finnish_in_file(file_path)
            
            if finnish_lines:
                files_with_finnish += 1
                total_found += process_finnish_findings(report, finnish_lines, file_path)
    
    return total_found, files_with_finnish

def write_report_summary(report, total_found, files_with_finnish):
    """Write the final summary to the report."""
    report.write("\n" + "=" * 50 + "\n")
    report.write(
        f"Summary: Found {total_found} Finnish occurrences in "
        f"{files_with_finnish} files in the dist directory.\n"
    )

def scan_project_for_finnish():
    """Scan all files and search for Finnish text."""
    report_path = os.path.join(PROJECT_DIR, "cascade_finnish_report.txt")
    total_found = 0
    files_with_finnish = 0
    
    with open(report_path, 'w', encoding='utf-8') as report:
        write_report_header(report)
        
        dist_dir = os.path.join(PROJECT_DIR, 'dist')
        if os.path.exists(dist_dir):
            total_found, files_with_finnish = scan_dist_directory(report, dist_dir)
        else:
            report.write("Dist directory not found. The project may not be built yet.\n\n")

        write_report_summary(report, total_found, files_with_finnish)

    print(f"Report saved to: {report_path}")
    print(f"Found {total_found} Finnish occurrences in {files_with_finnish} files in the dist directory.")

if __name__ == "__main__":
    scan_project_for_finnish()
