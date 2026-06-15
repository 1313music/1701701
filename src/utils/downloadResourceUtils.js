const RESOURCE_SECTION_TITLES = new Set(['其他资源']);

export const isResourceSection = (section) => (
  RESOURCE_SECTION_TITLES.has(String(section?.title || '').trim())
);

export const splitDownloadResourceSections = (sections = []) => {
  const sourceSections = Array.isArray(sections) ? sections : [];

  return {
    downloadSections: sourceSections.filter((section) => !isResourceSection(section)),
    resourceSections: sourceSections.filter(isResourceSection)
  };
};

export const countSectionItems = (section) => {
  const groups = Array.isArray(section?.groups) ? section.groups : [];
  return groups.reduce((total, group) => (
    total + (Array.isArray(group?.items) ? group.items.length : 0)
  ), 0);
};
