import os
import re

target_dir = r'c:\Users\Dhanu\.gemini\antigravity\scratch\AetherMind\claude_ui'

head_additions = """
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Manrope:wght@100..900&display=swap" rel="stylesheet"/>
<style>
    .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
</style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-surface-variant": "#464553",
                      "on-primary": "#ffffff",
                      "on-primary-fixed": "#0f0069",
                      "secondary": "#712ae2",
                      "background": "#f9f9ff",
                      "secondary-fixed-dim": "#d2bbff",
                      "on-secondary-container": "#fffbff",
                      "surface-variant": "#d8e3fb",
                      "on-tertiary": "#ffffff",
                      "error-container": "#ffdad6",
                      "surface-container-lowest": "#ffffff",
                      "on-primary-fixed-variant": "#3b35a7",
                      "surface-bright": "#f9f9ff",
                      "secondary-fixed": "#eaddff",
                      "on-secondary-fixed": "#25005a",
                      "outline": "#777584",
                      "tertiary": "#2a2d2f",
                      "surface-container-low": "#f0f3ff",
                      "on-surface": "#111c2d",
                      "surface-container-highest": "#d8e3fb",
                      "on-tertiary-container": "#adb0b2",
                      "on-tertiary-fixed-variant": "#444749",
                      "on-primary-container": "#a9a7ff",
                      "secondary-container": "#8a4cfc",
                      "primary-container": "#3730a3",
                      "primary": "#1f108e",
                      "outline-variant": "#c8c4d5",
                      "tertiary-container": "#404345",
                      "tertiary-fixed": "#e0e3e5",
                      "primary-fixed": "#e2dfff",
                      "on-secondary": "#ffffff",
                      "surface-container": "#e7eeff",
                      "on-error": "#ffffff",
                      "surface-tint": "#544fc0",
                      "error": "#ba1a1a",
                      "surface-dim": "#cfdaf2",
                      "on-error-container": "#93000a",
                      "inverse-on-surface": "#ecf1ff",
                      "primary-fixed-dim": "#c3c0ff",
                      "inverse-primary": "#c3c0ff",
                      "on-background": "#111c2d",
                      "surface-container-high": "#dee8ff",
                      "surface": "#f9f9ff",
                      "inverse-surface": "#263143",
                      "on-tertiary-fixed": "#191c1e",
                      "on-secondary-fixed-variant": "#5a00c6",
                      "tertiary-fixed-dim": "#c4c7c9"
              },
              "borderRadius": {
                      "DEFAULT": "0.25rem",
                      "lg": "0.5rem",
                      "xl": "0.75rem",
                      "full": "9999px"
              },
              "spacing": {
                      "gutter": "24px",
                      "md": "16px",
                      "margin-mobile": "16px",
                      "margin-desktop": "40px",
                      "lg": "24px",
                      "xs": "4px",
                      "sm": "8px",
                      "xl": "32px",
                      "max-width": "1280px",
                      "base": "8px"
              },
              "fontFamily": {
                      "label-lg": ["Inter"],
                      "headline-md": ["Manrope"],
                      "body-md": ["Inter"],
                      "label-md": ["Inter"],
                      "label-sm": ["Inter"],
                      "headline-lg-mobile": ["Manrope"],
                      "headline-sm": ["Manrope"],
                      "body-sm": ["Inter"],
                      "body-lg": ["Inter"],
                      "headline-lg": ["Manrope"]
              },
              "fontSize": {
                      "label-lg": ["14px", { "lineHeight": "20px", "letterSpacing": "0.02em", "fontWeight": "600" }],
                      "headline-md": ["28px", { "lineHeight": "36px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                      "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                      "label-md": ["12px", { "lineHeight": "16px", "letterSpacing": "0.04em", "fontWeight": "500" }],
                      "label-sm": ["11px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "500" }],
                      "headline-lg-mobile": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
                      "headline-sm": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
                      "body-sm": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                      "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
                      "headline-lg": ["40px", { "lineHeight": "48px", "letterSpacing": "-0.02em", "fontWeight": "700" }]
              }
            },
          },
        }
</script>
"""

files_to_update = ['settings.html', 'tools.html', 'login.html', 'dashboard.html']

for filename in files_to_update:
    filepath = os.path.join(target_dir, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Insert before </head> if it exists
        if '</head>' in content:
            # We don't want to duplicate tailwind config if already there, but assuming it's an old config
            # Let's just insert it before </head>
            new_content = content.replace('</head>', head_additions + '\n</head>')
            
            # Update the body tag class to reflect new theme
            new_content = re.sub(r'<body[^>]*>', '<body class="bg-surface font-body-md text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">', new_content)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filename}')
        else:
            print(f'No </head> found in {filename}')
    else:
        print(f'File {filename} not found')
