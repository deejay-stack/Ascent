-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 7,
    "unit" TEXT NOT NULL,
    "brand" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "store_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashier" TEXT NOT NULL,
    "cashier_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "amount_received" DECIMAL(12,2) NOT NULL,
    "change" DECIMAL(12,2) NOT NULL,
    "payment_id" TEXT NOT NULL,
    "order_id" TEXT,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "responsible_user" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Awaiting payment',
    "fulfillment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "name" TEXT NOT NULL DEFAULT 'ASCENT',
    "address" TEXT NOT NULL DEFAULT 'Store address, Philippines',
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "store_events" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "audience_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_category_id_is_archived_idx" ON "products"("category_id", "is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "sales_receipt_number_key" ON "sales"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_payment_id_key" ON "sales"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_id_key" ON "sales"("order_id");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "store_events_created_at_idx" ON "store_events"("created_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
