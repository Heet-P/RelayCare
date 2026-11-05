<?php
/**
 * Plugin Name: RelayCare for WooCommerce
 * Description: Adds a "Get Support" action to customer orders that opens RelayCare after-sales service.
 * Version: 0.1.0
 * Requires Plugins: woocommerce
 * Author: RelayCare
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

const RELAYCARE_OPTION = 'relaycare_settings';

/** Saved settings: RelayCare app URL, integration id, and the link-signing secret. */
function relaycare_settings(): array
{
    return wp_parse_args(get_option(RELAYCARE_OPTION, []), ['app_url' => '', 'integration_id' => '', 'link_secret' => '']);
}

/**
 * Signed "Get Support" link. RelayCare verifies the HMAC and expiry, then STILL requires the
 * customer to prove the email (OTP) before showing any order data: an order id in a URL is
 * never treated as authentication (spec §8).
 */
function relaycare_support_url(WC_Order $order): ?string
{
    $s = relaycare_settings();
    if (!$s['app_url'] || !$s['integration_id'] || !$s['link_secret']) {
        return null;
    }
    $params = [
        'i'   => $s['integration_id'],
        'o'   => (string) $order->get_id(),
        'e'   => strtolower($order->get_billing_email()),
        'exp' => (string) (time() + 30 * MINUTE_IN_SECONDS),
    ];
    $params['sig'] = hash_hmac('sha256', implode('|', [$params['i'], $params['o'], $params['e'], $params['exp']]), $s['link_secret']);
    return untrailingslashit($s['app_url']) . '/support/start?' . http_build_query($params);
}

// My Account > Orders: [View] [Get Support]
add_filter('woocommerce_my_account_my_orders_actions', function (array $actions, WC_Order $order) {
    $url = relaycare_support_url($order);
    if ($url) {
        $actions['relaycare_support'] = ['url' => $url, 'name' => __('Get Support', 'relaycare')];
    }
    return $actions;
}, 10, 2);

// Single order view: a prominent button under the order table.
add_action('woocommerce_order_details_after_order_table', function (WC_Order $order) {
    $url = relaycare_support_url($order);
    if ($url && is_account_page()) {
        printf(
            '<p class="relaycare-support"><a class="button" href="%s">%s</a></p>',
            esc_url($url),
            esc_html__('Get Support for this order', 'relaycare')
        );
    }
});

// Settings: WooCommerce > RelayCare
add_action('admin_menu', function () {
    add_submenu_page('woocommerce', 'RelayCare', 'RelayCare', 'manage_woocommerce', 'relaycare', 'relaycare_settings_page');
});

add_action('admin_init', function () {
    register_setting('relaycare', RELAYCARE_OPTION, [
        'sanitize_callback' => function ($in) {
            return [
                'app_url'        => esc_url_raw($in['app_url'] ?? ''),
                'integration_id' => sanitize_text_field($in['integration_id'] ?? ''),
                'link_secret'    => sanitize_text_field($in['link_secret'] ?? ''),
            ];
        },
    ]);
});

function relaycare_settings_page(): void
{
    $s = relaycare_settings();
    ?>
    <div class="wrap">
        <h1>RelayCare</h1>
        <p>Copy these values from RelayCare &rsaquo; Settings &rsaquo; Integrations.</p>
        <form method="post" action="options.php">
            <?php settings_fields('relaycare'); ?>
            <table class="form-table">
                <tr><th><label for="rc-url">RelayCare URL</label></th>
                    <td><input id="rc-url" class="regular-text" type="url" name="<?php echo RELAYCARE_OPTION; ?>[app_url]" value="<?php echo esc_attr($s['app_url']); ?>" placeholder="https://relaycare.example.com"></td></tr>
                <tr><th><label for="rc-id">Integration ID</label></th>
                    <td><input id="rc-id" class="regular-text" name="<?php echo RELAYCARE_OPTION; ?>[integration_id]" value="<?php echo esc_attr($s['integration_id']); ?>"></td></tr>
                <tr><th><label for="rc-secret">Link secret</label></th>
                    <td><input id="rc-secret" class="regular-text" type="password" autocomplete="off" name="<?php echo RELAYCARE_OPTION; ?>[link_secret]" value="<?php echo esc_attr($s['link_secret']); ?>"></td></tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
