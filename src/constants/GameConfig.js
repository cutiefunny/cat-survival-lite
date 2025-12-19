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

// --- 점프 설정 ---
export const JUMP_DURATION_MS = 600;
export const JUMP_HEIGHT_PIXEL = 50;
export const JUMP_COOLDOWN_MS = 800;
export const JUMP_SPEED_MULTIPLIER = 1.5;

// --- 적(Villain) 공통 설정 ---
export const MOUSE_SPAWN_INTERVAL_MS = 1000;
export const MAX_ACTIVE_MICE = 30;
export const DOG_SPAWN_INTERVAL_MS = 2000;
export const MAX_ACTIVE_DOGS = 20;

export const FLEE_RADIUS = 200;
export const FLEE_RADIUS_SQ = FLEE_RADIUS * FLEE_RADIUS;
export const GATHERING_RADIUS = 700;
export const GATHERING_RADIUS_SQ = GATHERING_RADIUS * GATHERING_RADIUS;

export const DOG_CHASE_SPEED = BASE_PLAYER_SPEED * 0.3; // 일반 개 속도

// --- [적 AI 심화 설정] ---
// [Type 1] 특수 추적 개체 (Smart/Fast)
export const SPECIAL_DOG_RATIO = 0.2;        // 등장 확률 (0.2 = 20%)
export const SPECIAL_DOG_SPEED_RATIO = 0.8;  // 플레이어 속도 대비 비율
export const SPECIAL_DOG_PREDICT_TIME = 0.5; // 미래 위치 예측 시간 (초) - 높을수록 더 앞서서 움직임
export const SPECIAL_DOG_TINT = 0xffaaaa;    // 색상 (Admin에서는 숫자로 표시됨)

// [Type 2] 매복형 개체 (Ambush/Patrol)
export const AMBUSH_DOG_RATIO = 0.2;         // 등장 확률
export const AMBUSH_DETECT_RADIUS = 350;     // 플레이어 감지 거리
export const AMBUSH_RELEASE_RADIUS = 600;    // 추격 포기 거리
export const AMBUSH_PATROL_RADIUS = 500;     // 배회 시 랜덤 목표 반경 (사용 안 함, 아래 로직 대체)
export const AMBUSH_PATROL_SPEED_RATIO = 0.8; // 배회 중일 때 속도 비율 (추격 속도 대비)
export const AMBUSH_PATROL_MIN_DIST = 800;   // 배회 목표지점 선정 시 플레이어와의 최소 거리
export const AMBUSH_DOG_TINT = 0xaaaaff;     // 색상

// [물리] 적끼리 겹침 방지 (Separation)
export const DOG_SEPARATION_RADIUS = 70;     // 서로 밀어내는 거리
export const DOG_SEPARATION_FORCE = 1.5;     // 밀어내는 힘의 배수

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