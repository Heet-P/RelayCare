<?php
/**
 * DEV ONLY (mounted by docker-compose, never shipped): lets WooCommerce deliver webhooks to
 * RelayCare running on the host at http://host.docker.internal:3000. WordPress otherwise
 * refuses "safe" HTTP requests to private addresses.
 */
add_filter('http_request_host_is_external', function ($external, $host) {
    return $host === 'host.docker.internal' ? true : $external;
}, 10, 2);
add_filter('http_request_args', function ($args, $url) {
    if (str_contains($url, 'host.docker.internal')) {
        $args['reject_unsafe_urls'] = false;
    }
    return $args;
}, 10, 2);

// The plugin's server-to-server status calls go to RelayCare on the host machine.
add_filter('relaycare_api_url', function ($url) {
    return str_replace(['//localhost:', '//127.0.0.1:'], '//host.docker.internal:', $url);
});
