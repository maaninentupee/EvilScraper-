#!/usr/bin/env python3
import sys
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime

# Check if a file path is provided
if len(sys.argv) < 2:
    print("Usage: python3 analyze-ollama-monitoring.py <csv_file>")
    sys.exit(1)

csv_file = sys.argv[1]
print(f"Analyzing file: {csv_file}")
OLLAMA_CPU_COL = 'Ollama CPU %'
OLLAMA_MEMORY_COL = 'Ollama Memory %'
OLLAMA_MEMORY_MB_COL = 'Ollama Memory MB'
MEMORY_USAGE_COL = 'Memory Usage %'
# Read the CSV file
try:
    df = pd.read_csv(csv_file)
    print(f"Successfully loaded data with {len(df)} rows")
except Exception as e:
    print(f"Error loading CSV file: {e}")
    sys.exit(1)

# Convert timestamp to datetime
df['Datetime'] = pd.to_datetime(df['Timestamp'], unit='s')

# Calculate statistics
print("\n=== RESOURCE USAGE SUMMARY ===")
print("\nCPU Usage:")
print(f"  System CPU Load: avg={df['CPU Load'].mean():.2f}, max={df['CPU Load'].max():.2f}, min={df['CPU Load'].min():.2f}")
if OLLAMA_CPU_COL in df.columns and df[OLLAMA_CPU_COL].notna().any():
    # Convert any string values to numeric, coercing errors to NaN
    df[OLLAMA_CPU_COL] = pd.to_numeric(df[OLLAMA_CPU_COL], errors='coerce')
    ollama_cpu = df[OLLAMA_CPU_COL].dropna()
    if len(ollama_cpu) > 0:
        print(f"  Ollama CPU Usage: avg={ollama_cpu.mean():.2f}%, max={ollama_cpu.max():.2f}%, min={ollama_cpu.min():.2f}%")
    else:
        print("  Ollama CPU Usage: No valid data")
else:
    print("  Ollama CPU Usage: No data available")

print("\nMemory Usage:")
print(f"  System Memory: avg={df[MEMORY_USAGE_COL].mean():.2f}%, max={df[MEMORY_USAGE_COL].max():.2f}%, min={df[MEMORY_USAGE_COL].min():.2f}%")
print(f"  Free Memory: avg={df['Free Memory MB'].mean():.2f}MB, min={df['Free Memory MB'].min():.2f}MB")
if OLLAMA_MEMORY_COL in df.columns and df[OLLAMA_MEMORY_COL].notna().any():
    # Convert any string values to numeric, coercing errors to NaN
    df[OLLAMA_MEMORY_COL] = pd.to_numeric(df[OLLAMA_MEMORY_COL], errors='coerce')
    ollama_mem = df[OLLAMA_MEMORY_COL].dropna()
    if len(ollama_mem) > 0:
        print(f"  Ollama Memory Usage: avg={ollama_mem.mean():.2f}%, max={ollama_mem.max():.2f}%, min={ollama_mem.min():.2f}%")
    else:
        print("  Ollama Memory Usage: No valid data")
else:
    print("  Ollama Memory Usage: No data available")

if OLLAMA_MEMORY_MB_COL in df.columns and df[OLLAMA_MEMORY_MB_COL].notna().any():
    # Convert any string values to numeric, coercing errors to NaN
    df[OLLAMA_MEMORY_MB_COL] = pd.to_numeric(df[OLLAMA_MEMORY_MB_COL], errors='coerce')
    ollama_mem_mb = df[OLLAMA_MEMORY_MB_COL].dropna()
    if len(ollama_mem_mb) > 0:
        print(f"  Ollama Memory Consumption: avg={ollama_mem_mb.mean():.2f}MB, max={ollama_mem_mb.max():.2f}MB")
    else:
        print("  Ollama Memory Consumption: No valid data")
else:
    print("  Ollama Memory Consumption: No data available")

print("\nNetwork Usage:")
print(f"  Network In: avg={df['Network In KB/s'].mean():.2f}KB/s, max={df['Network In KB/s'].max():.2f}KB/s")
print(f"  Network Out: avg={df['Network Out KB/s'].mean():.2f}KB/s, max={df['Network Out KB/s'].max():.2f}KB/s")
print(f"  Total Network: avg={(df['Network In KB/s'] + df['Network Out KB/s']).mean():.2f}KB/s, max={(df['Network In KB/s'] + df['Network Out KB/s']).max():.2f}KB/s")

# Check for potential bottlenecks
print("\n=== POTENTIAL BOTTLENECKS ===")

# Memory pressure
high_mem_usage = df[df[MEMORY_USAGE_COL] > 95]
if len(high_mem_usage) > 0:
    print(f"- HIGH MEMORY PRESSURE: System memory usage exceeded 95% for {len(high_mem_usage)} of {len(df)} samples ({len(high_mem_usage)/len(df)*100:.1f}%)")
    print(f"  Average free memory during high usage: {high_mem_usage['Free Memory MB'].mean():.2f}MB")

# CPU bottlenecks
if OLLAMA_CPU_COL in df.columns and df[OLLAMA_CPU_COL].notna().any():
    ollama_cpu = pd.to_numeric(df[OLLAMA_CPU_COL], errors='coerce')
    high_cpu_usage = df[ollama_cpu > 80]
    if len(high_cpu_usage) > 0:
        print(f"- HIGH CPU USAGE: Ollama CPU usage exceeded 80% for {len(high_cpu_usage)} of {len(df)} samples ({len(high_cpu_usage)/len(df)*100:.1f}%)")
    
# Network bottlenecks
high_network = df[(df['Network In KB/s'] + df['Network Out KB/s']) > 1000]  # More than 1MB/s
if len(high_network) > 0:
    print(f"- HIGH NETWORK USAGE: Total network traffic exceeded 1MB/s for {len(high_network)} of {len(df)} samples ({len(high_network)/len(df)*100:.1f}%)")

# Correlation analysis
print("\n=== CORRELATION ANALYSIS ===")
numeric_cols = df.select_dtypes(include=[np.number]).columns
correlation_matrix = df[numeric_cols].corr()

# Print top correlations with Ollama CPU and Memory
if OLLAMA_CPU_COL in correlation_matrix.columns:
    print("\nFactors most correlated with Ollama CPU usage:")
    cpu_corr = correlation_matrix[OLLAMA_CPU_COL].sort_values(ascending=False)
    for col, val in cpu_corr.items():
        if col != OLLAMA_CPU_COL and not pd.isna(val):
            print(f"  {col}: {val:.3f}")

if OLLAMA_MEMORY_COL in correlation_matrix.columns:
    print("\nFactors most correlated with Ollama Memory usage:")
    mem_corr = correlation_matrix[OLLAMA_MEMORY_COL].sort_values(ascending=False)
    for col, val in mem_corr.items():
        if col != OLLAMA_MEMORY_COL and not pd.isna(val):
            print(f"  {col}: {val:.3f}")

# Generate charts
print("\nGenerating performance charts...")
try:
    # Create a figure with subplots
    fig, axs = plt.subplots(3, 1, figsize=(12, 15))
    
    # Plot CPU usage
    axs[0].plot(df['Datetime'], df['CPU Load'], label='System CPU Load')
    if OLLAMA_CPU_COL in df.columns and df[OLLAMA_CPU_COL].notna().any():
        axs[0].plot(df['Datetime'], pd.to_numeric(df[OLLAMA_CPU_COL], errors='coerce'), label=OLLAMA_CPU_COL)
    axs[0].set_title('CPU Usage Over Time')
    axs[0].set_ylabel('CPU Usage')
    axs[0].legend()
    axs[0].grid(True)
    
    # Plot Memory usage
    axs[1].plot(df['Datetime'], df[MEMORY_USAGE_COL], label='System Memory %')
    if OLLAMA_MEMORY_COL in df.columns and df[OLLAMA_MEMORY_COL].notna().any():
        axs[1].plot(df['Datetime'], pd.to_numeric(df[OLLAMA_MEMORY_COL], errors='coerce'), label=OLLAMA_MEMORY_COL)
    if OLLAMA_MEMORY_MB_COL in df.columns and df[OLLAMA_MEMORY_MB_COL].notna().any():
        ax2 = axs[1].twinx()
        ax2.plot(df['Datetime'], pd.to_numeric(df[OLLAMA_MEMORY_MB_COL], errors='coerce'), 'r-', label=OLLAMA_MEMORY_MB_COL)
        ax2.set_ylabel('Memory (MB)', color='r')
    axs[1].set_title('Memory Usage Over Time')
    axs[1].set_ylabel('Memory Usage %')
    axs[1].legend()
    axs[1].grid(True)
    
    # Plot Network usage
    axs[2].plot(df['Datetime'], df['Network In KB/s'], label='Network In (KB/s)')
    axs[2].plot(df['Datetime'], df['Network Out KB/s'], label='Network Out (KB/s)')
    axs[2].set_title('Network Usage Over Time')
    axs[2].set_ylabel('KB/s')
    axs[2].legend()
    axs[2].grid(True)
    
    # Format x-axis to show time
    for ax in axs:
        ax.set_xlabel('Time')
    
    plt.tight_layout()
    output_file = csv_file.replace('.csv', '_analysis.png')
    plt.savefig(output_file)
    plt.close()
    print(f"Charts saved to {output_file}")
except Exception as e:
    print(f"Error generating charts: {e}")

print("\nAnalysis complete!")
