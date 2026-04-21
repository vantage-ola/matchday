-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "wallet_balance" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "home_team_logo" TEXT,
    "away_team_logo" TEXT,
    "league" TEXT NOT NULL,
    "kickoff_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "real_home_goals" INTEGER,
    "real_away_goals" INTEGER,
    "raw_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchupSession" (
    "id" TEXT NOT NULL,
    "lobby_id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "player1_id" TEXT NOT NULL,
    "player2_id" TEXT,
    "player1_side" TEXT NOT NULL,
    "player2_side" TEXT NOT NULL,
    "stake_per_player" INTEGER NOT NULL,
    "pot" INTEGER NOT NULL,
    "game_mode" TEXT NOT NULL DEFAULT 'matchup_only',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchupResult" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "player1_goals" INTEGER NOT NULL,
    "player2_goals" INTEGER NOT NULL,
    "player1_possession" INTEGER NOT NULL,
    "player2_possession" INTEGER NOT NULL,
    "player1_tackles" INTEGER NOT NULL,
    "player2_tackles" INTEGER NOT NULL,
    "player1_shots" INTEGER NOT NULL,
    "player2_shots" INTEGER NOT NULL,
    "player1_assists" INTEGER NOT NULL,
    "player2_assists" INTEGER NOT NULL,
    "player_events" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchupResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "player1_matchup_score" DECIMAL(5,2),
    "player2_matchup_score" DECIMAL(5,2),
    "player1_accuracy_score" DECIMAL(5,2),
    "player2_accuracy_score" DECIMAL(5,2),
    "player1_combined_score" DECIMAL(5,2),
    "player2_combined_score" DECIMAL(5,2),
    "player1_payout" INTEGER,
    "player2_payout" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_external_id_key" ON "Fixture"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "MatchupResult_session_id_key" ON "MatchupResult"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_session_id_key" ON "Settlement"("session_id");

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupSession" ADD CONSTRAINT "MatchupSession_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupSession" ADD CONSTRAINT "MatchupSession_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupSession" ADD CONSTRAINT "MatchupSession_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupSession" ADD CONSTRAINT "MatchupSession_lobby_id_fkey" FOREIGN KEY ("lobby_id") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupResult" ADD CONSTRAINT "MatchupResult_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "MatchupSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "MatchupSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
