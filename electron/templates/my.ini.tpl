[mysqld]
basedir = "{{basedir}}"
datadir = "{{datadir}}"
port = {{port}}
bind-address = 127.0.0.1
log_error = "{{logerror}}"
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Memory optimization (hemat RAM)
innodb_buffer_pool_size = 64M
key_buffer_size = 16M
max_connections = 50
performance_schema = OFF

[client]
port = {{port}}
default-character-set = utf8mb4

