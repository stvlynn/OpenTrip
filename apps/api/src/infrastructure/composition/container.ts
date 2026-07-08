import {
  TripService,
  TripInviteService,
  PreferenceService,
  WeatherService,
  AgentService,
} from "../../application";
import { AvatarService, type FileStorage } from "../../application/avatar";
import { createPool, type Pool } from "../persistence/pool";
import { PgTripRepository } from "../persistence/trip-repository.pg";
import { PgTripInviteRepository } from "../persistence/invite-repository.pg";
import { PgUserPreferenceRepository } from "../persistence/user-preference-repository.pg";
import { PgAgentSessionRepository } from "../persistence/agent-repository.pg";
import { createAuth, type Auth } from "../auth/auth";
import { CachedWeatherClient } from "../weather/cached-weather-client";
import { OpenWeatherMapClient } from "../weather/openweather-client";
import { AiSdkAgentModel } from "../ai/agent-model.ai-sdk";
import type { AppConfig } from "../config";

export interface Container {
  config: AppConfig;
  pool: Pool;
  auth: Auth;
  tripService: TripService;
  tripInviteService: TripInviteService;
  preferenceService: PreferenceService;
  weatherService: WeatherService;
  fileStorage: FileStorage;
  avatarService: AvatarService;
  /** Null when AI is not configured; agent routes then respond 404. */
  agentService: AgentService | null;
}

/** Wire the runtime-neutral object graph around a selected storage adapter. */
export function createContainer(config: AppConfig, fileStorage: FileStorage): Container {
  const pool = createPool(config.databaseUrl);
  const auth = createAuth(config, pool);
  const tripRepository = new PgTripRepository(pool);
  const tripService = new TripService(tripRepository);
  const tripInviteService = new TripInviteService(
    new PgTripInviteRepository(pool),
    tripRepository,
  );
  const preferenceService = new PreferenceService(new PgUserPreferenceRepository(pool));
  const avatarService = new AvatarService(fileStorage);
  const openWeatherClient = new OpenWeatherMapClient(config.openWeatherMapApiKey);
  const cachedWeatherClient = new CachedWeatherClient(openWeatherClient);
  const weatherService = new WeatherService(cachedWeatherClient);
  const agentService = config.ai
    ? new AgentService(
        tripRepository,
        new PgAgentSessionRepository(pool),
        new AiSdkAgentModel(config.ai, weatherService),
        {
          proactiveThreshold: config.ai.proactiveThreshold,
          replyThreshold: config.ai.replyThreshold,
        },
      )
    : null;
  return {
    config,
    pool,
    auth,
    tripService,
    tripInviteService,
    preferenceService,
    weatherService,
    fileStorage,
    avatarService,
    agentService,
  };
}
