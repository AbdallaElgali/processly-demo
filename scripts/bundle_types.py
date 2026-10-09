import os

output_file = "_bundled_frontend_types.md"
# Looking for files or folders containing these keywords
keywords = ['type', 'interface', 'schema', 'model', 'zod']
ignore_dirs = ['node_modules', '.next', 'dist', 'build', '.git', '.vscode']

with open(output_file, "w", encoding="utf-8") as out:
    out.write("# Frontend TypeScript Models, Types & Schemas\n\n")
    
    for root, dirs, files in os.walk("."):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            # We target .ts files (which usually hold pure types/logic), skipping .tsx UI components
            if file.endswith(".ts"):
                # Check if the file or its parent directory matches our keywords
                if any(k in file.lower() or k in root.lower() for k in keywords):
                    filepath = os.path.join(root, file)
                    
                    out.write(f"### `{filepath}`\n")
                    out.write("```typescript\n")
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            out.write(f.read())
                    except Exception as e:
                        out.write(f"// Error reading file: {e}\n")
                    out.write("\n```\n\n")

print(f"Done! Created {output_file}")



