[PHP]
engine = On
short_open_tag = Off
precision = 14
output_buffering = 4096
zlib.output_compression = Off
implicit_flush = Off
serialize_precision = -1
zend.enable_gc = On

max_execution_time = 120
max_input_time = 60
memory_limit = 256M

error_reporting = E_ALL
display_errors = On
display_startup_errors = On
log_errors = On
error_log = "{{errorlog}}"

default_mimetype = "text/html"
default_charset = "UTF-8"

enable_dl = Off
file_uploads = On
upload_max_filesize = 64M
max_file_uploads = 20
post_max_size = 64M

extension_dir = "{{extensiondir}}"

; Ekstensi yang terdeteksi aktif
{{extensions}}

[Date]
date.timezone = Asia/Jakarta

[MySQLi]
mysqli.default_port = 3306
mysqli.default_socket =
mysqli.default_host = 127.0.0.1
mysqli.default_user =
mysqli.default_pw =
mysqli.reconnect = Off

[Session]
session.save_handler = files
session.use_strict_mode = 0
session.use_cookies = 1
session.use_only_cookies = 1
session.name = PHPSESSID
session.auto_start = 0
session.cookie_lifetime = 0
session.cookie_path = /
session.cookie_domain =
session.cookie_httponly =
session.cookie_samesite =
session.serialize_handler = php
session.gc_probability = 1
session.gc_divisor = 1000
session.gc_maxlifetime = 1440
session.cache_limiter = nocache
session.cache_expire = 180
session.use_trans_sid = 0
session.sid_length = 26
session.trans_sid_tags = "a=href,area=href,frame=src,form="
session.sid_bits_per_character = 5
