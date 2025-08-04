import type { 
  EnhancedSubsidy, 
  EnhancedSubsidyDataset,
  SubsidyMetadata
} from '../types/enhanced-subsidy';
import type { EnhancedSubsidyFilter } from '../types/enhanced-filter';

/**
 * Enhanced subsidy search using metadata
 */
export class EnhancedSubsidySearch {
  private subsidies: EnhancedSubsidy[];

  constructor(dataset: EnhancedSubsidyDataset) {
    this.subsidies = dataset.subsidies;
  }

  /**
   * Search subsidies with enhanced filters
   */
  search(filter: EnhancedSubsidyFilter): EnhancedSubsidy[] {
    let results = [...this.subsidies];

    // Apply area filter
    if (filter.area) {
      results = this.filterByArea(results, filter.area);
    }

    // Apply amount filter
    if (filter.amount) {
      results = this.filterByAmount(results, filter.amount);
    }

    // Apply purpose filter (categories and keywords)
    if (filter.purpose) {
      results = this.filterByPurpose(results, filter.purpose);
    }

    // Apply company filter
    if (filter.company) {
      results = this.filterByCompany(results, filter.company);
    }

    // Apply deadline filter
    if (filter.deadline) {
      results = this.filterByDeadline(results, filter.deadline);
    }

    // Sort results
    if (filter.sortBy) {
      results = this.sortResults(results, filter.sortBy);
    }

    // Apply pagination
    if (filter.pagination) {
      const { page, limit } = filter.pagination;
      const start = (page - 1) * limit;
      results = results.slice(start, start + limit);
    }

    return results;
  }

  /**
   * Filter by area
   */
  private filterByArea(subsidies: EnhancedSubsidy[], areaFilter: any): EnhancedSubsidy[] {
    return subsidies.filter(subsidy => {
      const areaDetails = subsidy.metadata.areaDetails;

      // Check nationwide
      if (areaFilter.includeNationwide && areaDetails.isNationwide) {
        return true;
      }

      // Check prefecture match
      if (areaFilter.prefecture) {
        if (areaDetails.prefectures.includes(areaFilter.prefecture)) {
          return true;
        }
      }

      // Check city match
      if (areaFilter.cities && areaFilter.cities.length > 0) {
        if (areaDetails.cities) {
          const hasMatchingCity = areaFilter.cities.some((city: string) => 
            areaDetails.cities?.includes(city)
          );
          if (hasMatchingCity) return true;
        }
      }

      return false;
    });
  }

  /**
   * Filter by amount
   */
  private filterByAmount(subsidies: EnhancedSubsidy[], amountFilter: any): EnhancedSubsidy[] {
    return subsidies.filter(subsidy => {
      const amountDetails = subsidy.metadata.amountDetails;

      // Check min amount
      if (amountFilter.min !== undefined) {
        if (!amountDetails.maxAmount || amountDetails.maxAmount < amountFilter.min) {
          return false;
        }
      }

      // Check max amount
      if (amountFilter.max !== undefined) {
        if (amountDetails.minAmount && amountDetails.minAmount > amountFilter.max) {
          return false;
        }
      }

      // Check subsidy rate
      if (amountFilter.subsidyRate) {
        if (amountFilter.subsidyRate.min !== undefined) {
          if (!amountDetails.subsidyRateMax || amountDetails.subsidyRateMax < amountFilter.subsidyRate.min) {
            return false;
          }
        }
        if (amountFilter.subsidyRate.max !== undefined) {
          if (amountDetails.subsidyRateMin && amountDetails.subsidyRateMin > amountFilter.subsidyRate.max) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Filter by purpose (categories and keywords)
   */
  private filterByPurpose(subsidies: EnhancedSubsidy[], purposeFilter: any): EnhancedSubsidy[] {
    return subsidies.filter(subsidy => {
      const categoryTags = subsidy.metadata.categoryTags;

      // Check main categories
      if (purposeFilter.mainCategories && purposeFilter.mainCategories.length > 0) {
        const hasMatchingCategory = 
          purposeFilter.mainCategories.includes(categoryTags.primary) ||
          (categoryTags.secondary && categoryTags.secondary.some((cat: string) => 
            purposeFilter.mainCategories.includes(cat)
          ));
        
        if (!hasMatchingCategory) return false;
      }

      // Check keywords
      if (purposeFilter.keywords && purposeFilter.keywords.length > 0) {
        const subsidyKeywords = categoryTags.keywords.map(k => k.toLowerCase());
        const hasMatchingKeyword = purposeFilter.keywords.some((keyword: string) => 
          subsidyKeywords.includes(keyword.toLowerCase())
        );
        
        if (!hasMatchingKeyword) return false;
      }

      return true;
    });
  }

  /**
   * Filter by company attributes
   */
  private filterByCompany(subsidies: EnhancedSubsidy[], companyFilter: any): EnhancedSubsidy[] {
    return subsidies.filter(subsidy => {
      const targetCompany = subsidy.metadata.targetCompany;

      // Check company size
      if (companyFilter.companySize) {
        if (!targetCompany.companySize || !targetCompany.companySize.includes(companyFilter.companySize)) {
          // If company size is not specified in the subsidy, we can't determine eligibility
          // So we include it unless it's explicitly for a different size
          if (targetCompany.companySize && targetCompany.companySize.length > 0) {
            return false;
          }
        }
      }

      // Check employee count
      if (companyFilter.employeeCount) {
        if (targetCompany.employeeCount) {
          // Check if the filter's employee count is within the subsidy's range
          if (companyFilter.employeeCount.min !== undefined) {
            if (targetCompany.employeeCount.max !== undefined && 
                companyFilter.employeeCount.min > targetCompany.employeeCount.max) {
              return false;
            }
          }
          if (companyFilter.employeeCount.max !== undefined) {
            if (targetCompany.employeeCount.min !== undefined && 
                companyFilter.employeeCount.max < targetCompany.employeeCount.min) {
              return false;
            }
          }
        }
      }

      // Check special conditions
      if (companyFilter.specialConditions && companyFilter.specialConditions.length > 0) {
        if (!targetCompany.specialConditions || targetCompany.specialConditions.length === 0) {
          return false;
        }
        const hasMatchingCondition = companyFilter.specialConditions.some((condition: string) =>
          targetCompany.specialConditions?.includes(condition as any)
        );
        if (!hasMatchingCondition) return false;
      }

      return true;
    });
  }

  /**
   * Filter by deadline
   */
  private filterByDeadline(subsidies: EnhancedSubsidy[], deadlineFilter: any): EnhancedSubsidy[] {
    return subsidies.filter(subsidy => {
      const applicationDetails = subsidy.metadata.applicationDetails;

      // Check status
      if (deadlineFilter.status) {
        if (applicationDetails.status !== deadlineFilter.status) {
          return false;
        }
      }

      // Check days until deadline
      if (deadlineFilter.daysUntilDeadline) {
        if (!applicationDetails.daysUntilDeadline) return false;
        
        if (deadlineFilter.daysUntilDeadline.min !== undefined) {
          if (applicationDetails.daysUntilDeadline < deadlineFilter.daysUntilDeadline.min) {
            return false;
          }
        }
        if (deadlineFilter.daysUntilDeadline.max !== undefined) {
          if (applicationDetails.daysUntilDeadline > deadlineFilter.daysUntilDeadline.max) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Sort results
   */
  private sortResults(subsidies: EnhancedSubsidy[], sortBy: string): EnhancedSubsidy[] {
    const sorted = [...subsidies];

    switch (sortBy) {
      case 'amount_desc':
        return sorted.sort((a, b) => {
          const aAmount = a.metadata.amountDetails.maxAmount || 0;
          const bAmount = b.metadata.amountDetails.maxAmount || 0;
          return bAmount - aAmount;
        });

      case 'amount_asc':
        return sorted.sort((a, b) => {
          const aAmount = a.metadata.amountDetails.maxAmount || 0;
          const bAmount = b.metadata.amountDetails.maxAmount || 0;
          return aAmount - bAmount;
        });

      case 'deadline_asc':
        return sorted.sort((a, b) => {
          const aDays = a.metadata.applicationDetails.daysUntilDeadline || Infinity;
          const bDays = b.metadata.applicationDetails.daysUntilDeadline || Infinity;
          return aDays - bDays;
        });

      case 'relevance':
      default:
        // Sort by confidence score
        return sorted.sort((a, b) => {
          const aScore = a.metadata.confidenceScore || 0;
          const bScore = b.metadata.confidenceScore || 0;
          return bScore - aScore;
        });
    }
  }

  /**
   * Get statistics about the dataset
   */
  getStatistics() {
    const stats = {
      total: this.subsidies.length,
      byCategory: {} as Record<string, number>,
      byArea: {} as Record<string, number>,
      byCompanySize: {} as Record<string, number>,
      withEmployeeCount: 0,
      averageConfidenceScore: 0
    };

    let totalConfidence = 0;

    this.subsidies.forEach(subsidy => {
      // Category stats
      const primary = subsidy.metadata.categoryTags.primary;
      stats.byCategory[primary] = (stats.byCategory[primary] || 0) + 1;

      // Area stats
      if (subsidy.metadata.areaDetails.isNationwide) {
        stats.byArea['全国'] = (stats.byArea['全国'] || 0) + 1;
      } else {
        subsidy.metadata.areaDetails.prefectures.forEach(pref => {
          stats.byArea[pref] = (stats.byArea[pref] || 0) + 1;
        });
      }

      // Company size stats
      if (subsidy.metadata.targetCompany.companySize) {
        subsidy.metadata.targetCompany.companySize.forEach(size => {
          stats.byCompanySize[size] = (stats.byCompanySize[size] || 0) + 1;
        });
      }

      // Employee count stats
      if (subsidy.metadata.targetCompany.employeeCount) {
        stats.withEmployeeCount++;
      }

      // Confidence score
      totalConfidence += subsidy.metadata.confidenceScore || 0;
    });

    stats.averageConfidenceScore = Math.round(totalConfidence / this.subsidies.length);

    return stats;
  }
}