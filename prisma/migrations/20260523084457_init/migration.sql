-- CreateTable
CREATE TABLE "wordbooks" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "source" VARCHAR(50),
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wordbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "words" (
    "id" SERIAL NOT NULL,
    "wordbook_id" INTEGER NOT NULL,
    "word" VARCHAR(100) NOT NULL,
    "definition" TEXT,
    "phonetic" VARCHAR(100),
    "tags" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edges" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50),
    "api_key" TEXT,
    "model" VARCHAR(100),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "words_wordbook_id_idx" ON "words"("wordbook_id");

-- CreateIndex
CREATE INDEX "words_word_idx" ON "words"("word");

-- CreateIndex
CREATE INDEX "edges_source_id_target_id_idx" ON "edges"("source_id", "target_id");

-- CreateIndex
CREATE INDEX "edges_type_idx" ON "edges"("type");

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_wordbook_id_fkey" FOREIGN KEY ("wordbook_id") REFERENCES "wordbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;
