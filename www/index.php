<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Astra Web Server</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
        .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 500px; width: 100%; text-align: center; border: 1px solid #e2e8f0; }
        h1 { color: #2563eb; margin-top: 0; font-size: 1.8rem; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; background: #dbeafe; color: #1d4ed8; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
        p { margin: 0.5rem 0; font-size: 0.95rem; color: #64748b; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Astra Control Panel</h1>
        <div class="badge">Apache & MariaDB Running</div>
        <p>PHP Version: <strong><?php echo phpversion(); ?></strong></p>
        <p>Server Software: <strong><?php echo $_SERVER['SERVER_SOFTWARE']; ?></strong></p>
        <p style="margin-top: 1.5rem; font-size: 0.85rem;">Letakkan file web Anda di dalam folder <code>www/</code>.</p>
    </div>
</body>
</html>
