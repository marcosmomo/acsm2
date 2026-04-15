const DEFAULT_ACSM_ID = 'acsm2';

export const ACSM_ID = DEFAULT_ACSM_ID;

export const MANAGED_CPS_BY_ACSM = {
  acsm1: ['cps1', 'cps5', 'cps7'],
  acsm2: ['cps2', 'cps4', 'cps6'],
  acsm3: ['cps3', 'cps8', 'cps9'],
};

export const MANAGED_CPS_IDS = MANAGED_CPS_BY_ACSM[ACSM_ID] || [];

export const ACSM_CONFIGS = {
  acsm2: {
    id: 'acsm2',
    code: 'ACSM-2',
    name: 'ACSM-2',
    shortName: 'ACSM-2',
    industryId: 'industry2',
    industryName: 'Industry 2',
    description: 'Projeto independente da industria 2 responsavel por CPS2, CPS4 e CPS6.',
    managedCpsIds: MANAGED_CPS_BY_ACSM.acsm2,
    defaultCpsId: 'cps2',
    mqttNamespace: 'acsm2',
    topics: {
      wildcardOee: 'acsm2/+/oee',
      wildcardLearning: 'acsm2/+/learning',
      globalOee: 'acsm2/global/oee',
      globalReasoning: 'acsm2/global/reasoning',
      globalLearning: 'acsm2/global/learning',
      chainInput: 'acsm2/chain/input',
      chainInputs: ['acsm1/chain/input', 'acsm2/chain/input', 'acsm3/chain/input'],
      chainGlobalState: 'acsm1/chain/global/state',
      chainGlobalReasoning: 'acsm1/chain/global/reasoning',
      chainGlobalLearning: 'acsm1/chain/global/learning',
      chainCoordinatorOutput: 'acsm1/chain/coordinator/output',
      chainKnowledgeGlobal: 'acsm1/chain/knowledge/global',
      coordinatorOutput: 'acsm2/coordinator/output',
      lifecycleUnplugRequest: 'acsm2/lifecycle/unplug_request',
      lifecycleUpdateFunctions: 'acsm2/lifecycle/update_functions',
      knowledgeGlobal: 'acsm2/knowledge/global',
    },
    externalApis: {
      brokerApiBasePath: '/api/acsm2',
      coordinatorDecisionPath: '/api/coordinator/decision',
      coordinatorKnowledgePath: '/api/coordinator/knowledge',
    },
    report: {
      fileSlug: 'acsm-2',
      displayName: 'ACSM-2',
      architectureName: 'ACSM-2 - Architecture of Control for Smart Manufacturing',
    },
  },
};

export const normalizeCpsId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  const cleaned = raw.replace(/[^a-z0-9]/g, '');
  const match = cleaned.match(/^([a-z]+)0*([0-9]+)$/);

  if (match) return `${match[1]}${match[2]}`;
  return cleaned;
};

export const getAcsmConfig = (acsmId) => {
  const normalizedId = String(acsmId || DEFAULT_ACSM_ID).toLowerCase().trim();
  return ACSM_CONFIGS[normalizedId] || ACSM_CONFIGS[DEFAULT_ACSM_ID];
};

export const getActiveAcsmId = (explicitId) =>
  String(explicitId || process.env.NEXT_PUBLIC_ACSM_ID || process.env.ACSM_ID || DEFAULT_ACSM_ID)
    .toLowerCase()
    .trim();

export const getActiveAcsmConfig = (explicitId) =>
  getAcsmConfig(getActiveAcsmId(explicitId));

export const getManagedCpsIdsForAcsm = (acsmIdOrConfig) => {
  const acsmId =
    typeof acsmIdOrConfig === 'string'
      ? acsmIdOrConfig
      : acsmIdOrConfig?.id || getActiveAcsmId();

  const normalizedAcsmId = String(acsmId || DEFAULT_ACSM_ID).toLowerCase().trim();
  const configured = MANAGED_CPS_BY_ACSM[normalizedAcsmId];
  const fallback = Array.isArray(acsmIdOrConfig?.managedCpsIds)
    ? acsmIdOrConfig.managedCpsIds
    : getAcsmConfig(normalizedAcsmId).managedCpsIds;

  return (configured || fallback || []).map((id) => normalizeCpsId(id)).filter(Boolean);
};

export const getDefaultCpsIdForAcsm = (acsmId) =>
  getAcsmConfig(acsmId).defaultCpsId;

export const isCpsManagedByAcsm = (acsmIdOrConfig, cpsId) => {
  const normalizedCpsId = normalizeCpsId(cpsId);
  return getManagedCpsIdsForAcsm(acsmIdOrConfig).includes(normalizedCpsId);
};

export const isManagedCps = (cpsId, acsmIdOrConfig = getActiveAcsmConfig()) =>
  isCpsManagedByAcsm(acsmIdOrConfig, cpsId);

export const keepManagedValue = (value, acsmIdOrConfig = getActiveAcsmConfig()) => {
  const normalized = normalizeCpsId(value);
  return isManagedCps(normalized, acsmIdOrConfig) ? normalized : null;
};

export const filterContributionRanking = (ranking, acsmIdOrConfig = getActiveAcsmConfig()) => {
  if (!Array.isArray(ranking)) return [];

  return ranking
    .filter((item) => {
      const id = item?.cpsId || item?.id || item?.baseTopic || item?.cps || '';
      return isManagedCps(id, acsmIdOrConfig);
    })
    .map((item) => {
      const normalizedId = keepManagedValue(
        item?.cpsId || item?.id || item?.baseTopic || item?.cps,
        acsmIdOrConfig
      );

      return normalizedId
        ? {
            ...item,
            cpsId: normalizedId,
          }
        : item;
    });
};

const extractCpsTokens = (value) => String(value || '').match(/cps[\s_-]*0*\d+/gi) || [];

export const filterManagedArrayByCps = (arr, acsmIdOrConfig = getActiveAcsmConfig()) => {
  if (!Array.isArray(arr)) return [];

  return arr.filter((item) => {
    if (typeof item === 'string') {
      const ids = extractCpsTokens(item);
      if (!ids.length) return true;
      return ids.every((id) => isManagedCps(id, acsmIdOrConfig));
    }

    const ids = [
      item?.cpsId,
      item?.id,
      item?.baseTopic,
      item?.sourceCps,
      item?.targetCps,
      ...(Array.isArray(item?.relatedCps) ? item.relatedCps : [item?.relatedCps]),
    ]
      .map((id) => normalizeCpsId(id))
      .filter(Boolean);

    if (!ids.length) return true;
    return ids.every((id) => isManagedCps(id, acsmIdOrConfig));
  });
};

const getAasSpecificAssetValue = (aas, name) => {
  const items = aas?.assetInformation?.specificAssetIds || [];
  const match = items.find(
    (item) => String(item?.name || '').toLowerCase() === String(name || '').toLowerCase()
  );
  return match?.value ?? null;
};

export const extractCpsIdFromAas = (parsed) => {
  const aas = Array.isArray(parsed?.assetAdministrationShells)
    ? parsed.assetAdministrationShells[0]
    : null;

  const rawId =
    getAasSpecificAssetValue(aas, 'cpsId') ||
    aas?.idShort ||
    aas?.id ||
    parsed?.cpsId ||
    '';

  return normalizeCpsId(rawId);
};
