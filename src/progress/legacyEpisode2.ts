import type { ProgressDto } from '../api/types';
import type { Episode } from '../story/schema';

// Published E2 checkpoints from 8f23ce9. Result scenes stay beyond the choice
// whose effects the server has already committed; no choice effects run here.
const legacyScenes: Record<string, string> = {
  ep2_morning_after: 'ep2_morning',
  ep2_morning_branch: 'ep2_morning',
  ep2_junho_call: 'ep2_morning_called',
  ep2_soa_after_reply: 'ep2_morning_replied',
  ep2_quiet_morning: 'ep2_morning_saved',
  ep2_campus_notice: 'ep2_mina',
  ep2_event_hall: 'ep2_event',
  ep2_backstage_task: 'ep2_call',
  ep2_taeyun_number: 'ep2_recognized',
  ep2_choice_number: 'ep2_recognized',
  ep2_number_truth_result: 'ep2_phone_truth',
  ep2_number_press_result: 'ep2_phone_demand',
  ep2_number_lie_result: 'ep2_phone_lie',
  ep2_live_interrupt: 'ep2_last_call',
  ep2_practice_invite: 'ep2_last_call',
  ep2_practice_room: 'ep2_photo_choice',
  ep2_choice_photo: 'ep2_photo_choice',
  ep2_photo_full_result: 'ep2_photo_full',
  ep2_photo_crop_result: 'ep2_photo_pendant',
  ep2_photo_hide_result: 'ep2_photo_refuse',
  ep2_last_call: 'ep2_soa_incoming',
  ep2_soa_warning: 'ep2_soa_incoming',
  ep2_choice_archive: 'ep2_archive_choice',
  ep2_archive_with_taeyun: 'ep2_archive_taeyun',
  ep2_archive_with_mina: 'ep2_archive_mina',
  ep2_archive_ask_soa: 'ep2_archive_soa',
  ep2_archive_result: 'ep2_archive_permission',
  ep2_security_frame: 'ep2_archive_0226',
  ep2_rooftop: 'ep2_rooftop',
  ep2_choice_rooftop: 'ep2_rooftop_choice',
  ep2_roof_trust_result: 'ep2_rooftop_believe',
  ep2_roof_challenge_result: 'ep2_rooftop_suspect',
  ep2_roof_junho_result: 'ep2_rooftop_junho',
  ep2_keycard: 'ep2_card_intro',
  ep2_choice_keycard: 'ep2_card_choice',
  ep2_key_take_result: 'ep2_card_take',
  ep2_key_refuse_result: 'ep2_card_refuse',
  ep2_key_junho_result: 'ep2_card_send',
  ep2_elevator: 'ep2_lift_checkpoint',
  ep2_junho_arrives: 'ep2_confrontation',
  ep2_end: 'ep2_end',
};

const legacyResponses = [
  ['taeyun_told_sim', 'ep2_phone_response', 'truth'],
  ['pressed_taeyun_number', 'ep2_phone_response', 'demand'],
  ['lied_taeyun_number', 'ep2_phone_response', 'lie'],
  ['showed_taeyun_photo', 'ep2_photo_evidence', 'full'],
  ['showed_taeyun_crop', 'ep2_photo_evidence', 'pendant'],
  ['hid_photo_from_taeyun', 'ep2_photo_evidence', 'refuse'],
  ['went_archive_taeyun', 'ep2_archive_partner', 'taeyun'],
  ['asked_mina_archive', 'ep2_archive_partner', 'mina'],
  ['asked_soa_archive', 'ep2_archive_partner', 'soa'],
  ['trusted_taeyun', 'ep2_rooftop_response', 'believe'],
  ['challenged_taeyun', 'ep2_rooftop_response', 'suspect'],
  ['warned_junho_about_taeyun', 'ep2_rooftop_response', 'junho'],
  ['took_b17_keycard', 'ep2_card_response', 'take'],
  ['photographed_b17_keycard', 'ep2_card_response', 'refuse'],
  ['sent_keycard_junho', 'ep2_card_response', 'send'],
] as const;

export function normalizeEpisode2Progress(progress: ProgressDto | null, episode: Episode): ProgressDto | null {
  if (!progress || episode.id !== 'last-online-s1-e2' || !['last-online-s1-e2', 'episode-2'].includes(progress.episodeId)) return progress;
  const currentScene = episode.scenes.some(scene => scene.id === progress.sceneId);
  const mappedScene = Object.hasOwn(legacyScenes, progress.sceneId) ? legacyScenes[progress.sceneId] : undefined;
  // Unsupported progress stays unsupported so bootstrap presents its retry screen.
  if (!currentScene && !mappedScene) return progress;
  const hasLegacyResponse = legacyResponses.some(([flag]) => progress.flags[flag] === true);
  const hasCurrentResponse = Object.keys(progress.flags).some(flag => flag.startsWith('ep2_'));
  const legacy = !currentScene || (hasLegacyResponse && !hasCurrentResponse);
  if (!legacy) return progress.episodeId === episode.id ? progress : { ...progress, episodeId: episode.id };

  const flags = { ...progress.flags };
  for (const [oldFlag, newFlag, value] of legacyResponses) {
    if (flags[oldFlag] === true && !Object.hasOwn(flags, newFlag)) flags[newFlag] = value;
  }
  // In particular, legacy last_call follows the photo choice; the current scene
  // with the same ID precedes it. This marker prevents translating it twice.
  if (!Object.hasOwn(flags, 'ep2_legacy_normalized')) flags.ep2_legacy_normalized = true;
  return { ...progress, episodeId: episode.id, sceneId: mappedScene ?? progress.sceneId, flags };
}
