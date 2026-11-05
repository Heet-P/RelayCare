#!/usr/bin/env bash
# Seeds the local WooCommerce demo store (spec §13 "Demo store data"). Idempotent.
# Run:  docker compose -f docker/docker-compose.yml run --rm cli bash /seed/wp-seed.sh
set -euo pipefail
cd /var/www/html

until wp db check >/dev/null 2>&1; do echo "waiting for database…"; sleep 2; done

if ! wp core is-installed 2>/dev/null; then
  wp core install --url=http://localhost:8080 --title="Demo Electronics" \
    --admin_user=admin --admin_password=relaycare-admin --admin_email=admin@relaycare.test --skip-email
fi

# WooCommerce REST needs pretty permalinks.
wp rewrite structure '/%postname%/' --hard >/dev/null
wp plugin is-installed woocommerce || wp plugin install woocommerce
wp plugin activate woocommerce relaycare-woocommerce >/dev/null

wp option update woocommerce_currency INR >/dev/null
wp option update woocommerce_default_country "IN:GJ" >/dev/null
wp option update woocommerce_store_city "Ahmedabad" >/dev/null
wp option update woocommerce_coming_soon no >/dev/null
wp option update woocommerce_onboarding_profile '{"skipped":true}' --format=json >/dev/null

wp eval '
$sku = "AW7-7KG";
$pid = wc_get_product_id_by_sku($sku);
if (!$pid) {
  $p = new WC_Product_Simple();
  $p->set_name("AquaWash 7kg");
  $p->set_sku($sku);
  $p->set_regular_price("18999");
  $p->set_description("7 kg front-load washing machine. 12-month warranty.");
  $p->set_status("publish");
  $pid = $p->save();
}

$email = "customer@relaycare.test";
$address = [
  "first_name" => "Demo", "last_name" => "Customer", "email" => $email, "phone" => "+91 98765 43210",
  "address_1" => "12 Riverfront Road", "city" => "Ahmedabad", "state" => "GJ", "postcode" => "380009", "country" => "IN",
];
$user = get_user_by("email", $email);
$uid = $user ? $user->ID : wc_create_new_customer($email, "democustomer", "relaycare-demo-2026", ["first_name" => "Demo", "last_name" => "Customer"]);
$customer = new WC_Customer($uid);
foreach ($address as $k => $v) { if (is_callable([$customer, "set_billing_$k"])) $customer->{"set_billing_$k"}($v); if ($k !== "email" && is_callable([$customer, "set_shipping_$k"])) $customer->{"set_shipping_$k"}($v); }
$customer->save();

$existing = wc_get_orders(["limit" => 1, "meta_query" => [["key" => "_relaycare_demo", "value" => "WC-10842"]]]);
if (!$existing) {
  // Reserve id 10842 so the order number matches the spec demo ("Order #10842").
  global $wpdb;
  $wpdb->query("ALTER TABLE {$wpdb->posts} AUTO_INCREMENT = 10842");
  $o = wc_create_order(["customer_id" => $uid]);
  $item_id = $o->add_product(wc_get_product($pid), 1);
  // Serial numbers are not a standard line-item field (spec §5): stored as line-item meta.
  wc_add_order_item_meta($item_id, "serial_number", "AW7-DEMO-0042");
  $o->set_address($address, "billing");
  $o->set_address($address, "shipping");
  $o->set_payment_method_title("Cash on delivery");
  $o->calculate_totals();
  $o->update_meta_data("_relaycare_demo", "WC-10842");
  $o->set_status("completed");
  $o->set_date_created("2026-10-20 11:30:00");
  $o->set_date_paid("2026-10-20 11:30:00");
  $o->set_date_completed("2026-10-22 16:00:00");
  $o->save();
  echo "Created order #" . $o->get_order_number() . "\n";
} else {
  echo "Order #" . $existing[0]->get_order_number() . " already exists\n";
}

// Local-only REST key so RelayCare can be connected without clicking through wp-admin.
global $wpdb;
$table = $wpdb->prefix . "woocommerce_api_keys";
if (!$wpdb->get_var("SELECT key_id FROM $table WHERE description = \"RelayCare (local dev)\"")) {
  $ck = "ck_" . wc_rand_hash();
  $cs = "cs_" . wc_rand_hash();
  $wpdb->insert($table, [
    "user_id" => 1, "description" => "RelayCare (local dev)", "permissions" => "read_write",
    "consumer_key" => wc_api_hash($ck), "consumer_secret" => $cs, "truncated_key" => substr($ck, -7),
  ]);
  echo "REST key created (shown once):\n  consumer key:    $ck\n  consumer secret: $cs\n";
} else {
  echo "REST key \"RelayCare (local dev)\" already exists (delete it in WooCommerce > Settings > Advanced to regenerate)\n";
}
'
echo "Store ready: http://localhost:8080  (admin / relaycare-admin, customer@relaycare.test / relaycare-demo-2026)"
