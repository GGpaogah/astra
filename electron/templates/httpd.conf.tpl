Define SRVROOT "{{srvroot}}"

ServerRoot "${SRVROOT}"
Listen {{port}}

# Modul Inti Apache
LoadModule actions_module modules/mod_actions.so
LoadModule alias_module modules/mod_alias.so
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule autoindex_module modules/mod_autoindex.so
LoadModule dir_module modules/mod_dir.so
LoadModule env_module modules/mod_env.so
LoadModule headers_module modules/mod_headers.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule mime_module modules/mod_mime.so
LoadModule negotiation_module modules/mod_negotiation.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule setenvif_module modules/mod_setenvif.so

# Modul PHP
LoadModule php_module "{{phpmodule}}"
PHPIniDir "{{phpinidir}}"

ServerAdmin admin@localhost
ServerName localhost:{{port}}

<Directory />
    AllowOverride none
    Require all denied
</Directory>

DocumentRoot "{{documentroot}}"
<Directory "{{documentroot}}">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>

<IfModule dir_module>
    DirectoryIndex index.php index.html index.htm
</IfModule>

<Files ".ht*">
    Require all denied
</Files>

ErrorLog "{{errorlog}}"
LogLevel warn

<IfModule log_config_module>
    LogFormat "%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\"" combined
    LogFormat "%h %l %u %t \"%r\" %>s %b" common
    CustomLog "{{accesslog}}" common
</IfModule>

<IfModule mime_module>
    TypesConfig conf/mime.types
    AddType application/x-compress .Z
    AddType application/x-gzip .gz .tgz
    AddType application/x-httpd-php .php
    AddHandler application/x-httpd-php .php
</IfModule>

# File PID Apache
PidFile "{{pidfile}}"

# Virtual Hosts
IncludeOptional "{{vhostsdir}}/*.conf"
