// src/constants/GameConfig.js

// --- 맵 및 월드 설정 ---
export const WORLD_BOUNDS_SIZE = 100000;
export const TILE_SIZE = 32;
export const CHUNK_DIMENSIONS = 20;
export const CHUNK_SIZE_PX = CHUNK_DIMENSIONS * TILE_SIZE;
export const GENERATION_BUFFER_CHUNKS = 2;

// --- 플레이어 기본 설정 ---
export const INITIAL_PLAYER_ENERGY = 3;
export const BASE_PLAYER_SPEED = 200;
export const PLAYER_PUSH_BACK_FORCE = 300;
export const KNOCKBACK_DURATION_MS = 250;
export const PLAYER_INVINCIBILITY_DURATION_MS = 500;

// --- 적(Villain) 설정 ---
export const MOUSE_SPAWN_INTERVAL_MS = 1000;
export const MAX_ACTIVE_MICE = 30;
export const FLEE_RADIUS = 200;
export const FLEE_RADIUS_SQ = FLEE_RADIUS * FLEE_RADIUS;
export const GATHERING_RADIUS = 700;
export const GATHERING_RADIUS_SQ = GATHERING_RADIUS * GATHERING_RADIUS;

export const DOG_SPAWN_INTERVAL_MS = 2000;
export const MAX_ACTIVE_DOGS = 20;
export const DOG_CHASE_SPEED = BASE_PLAYER_SPEED * 0.3;

// --- 아이템 및 기타 설정 ---
export const FISH_SPAWN_INTERVAL_MS = 5000;
export const FISH_SPAWN_PROBABILITY = 0.3;
export const BUTTERFLY_SPAWN_INTERVAL_MS = 1000;
export const BUTTERFLY_SPAWN_PROBABILITY = 0.1;

// --- UI 치수 설정 ---
export const ENERGY_BAR_WIDTH = 60;
export const ENERGY_BAR_HEIGHT = 8;
export const EXP_BAR_WIDTH = 60;
export const EXP_BAR_HEIGHT = 6;

// --- 스킬 설정 ---
export const SHOCKWAVE_SKILL_ID = 51;
export const SHOCKWAVE_INTERVAL_MS = 10000;
export const SHOCKWAVE_RADIUS_START = 20;
export const SHOCKWAVE_RADIUS_END = 300;
export const SHOCKWAVE_DURATION_MS = 500;
export const SHOCKWAVE_PUSH_FORCE = 500;
export const SHOCKWAVE_COLOR = 0xADD8E6;
export const SHOCKWAVE_LINE_WIDTH = 10;

// --- 런타임 공유 데이터 ---
// (타일 색상은 런타임에 생성되지만, 전역적으로 유지되어야 하므로 이곳에 둡니다)
export const TILE_COLORS = [];