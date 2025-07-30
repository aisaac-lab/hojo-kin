interface SubsidySummary {
  id: string;
  name: string;
  title?: string;
  target_area_search?: string;
  subsidy_max_limit?: number;
  acceptance_start_datetime?: string;
  acceptance_end_datetime?: string;
  target_number_of_employees?: string;
}

interface SubsidyDetail extends SubsidySummary {
  subsidy_catch_phrase?: string;
  detail?: string;
  use_purpose?: string;
  industry?: string;
  target_area_detail?: string;
  subsidy_rate?: string;
  project_end_deadline?: string;
  request_reception_presence?: string;
  is_enable_multiple_request?: boolean;
  front_subsidy_detail_page_url?: string;
  application_guidelines?: Array<{
    name: string;
    data: string;
  }>;
  outline_of_grant?: Array<{
    name: string;
    data: string;
  }>;
  application_form?: Array<{
    name: string;
    data: string;
  }>;
}

interface ApiResponse<T> {
  metadata: {
    type: string;
    resultset: {
      count: number;
    };
  };
  result: T[];
}

const API_BASE_URL = "https://api.jgrants-portal.go.jp/exp/v1/public";

export class JGrantsApiClient {
  /**
   * 東京都の補助金一覧を取得
   */
  async fetchTokyoSubsidies(): Promise<SubsidySummary[]> {
    const params = new URLSearchParams({
      keyword: "東京",
      sort: "acceptance_end_datetime",
      order: "ASC",
      acceptance: "1", // 募集期間内のものに絞る
      target_area_search: "東京都",
    });

    const response = await fetch(`${API_BASE_URL}/subsidies?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data: ApiResponse<SubsidySummary> = await response.json();
    return data.result;
  }

  /**
   * 補助金の詳細情報を取得
   */
  async fetchSubsidyDetail(id: string): Promise<SubsidyDetail | null> {
    const response = await fetch(`${API_BASE_URL}/subsidies/id/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch subsidy detail for ID ${id}: ${response.status}`
      );
      return null;
    }

    const data: ApiResponse<SubsidyDetail> = await response.json();
    return data.result[0] || null;
  }

  /**
   * 東京都の全補助金の詳細情報を取得
   */
  async fetchAllTokyoSubsidyDetails(): Promise<SubsidyDetail[]> {
    // まず一覧を取得
    const subsidies = await this.fetchTokyoSubsidies();

    // 各補助金の詳細を並行して取得
    const detailPromises = subsidies.map((subsidy) =>
      this.fetchSubsidyDetail(subsidy.id)
    );

    const details = await Promise.all(detailPromises);

    // nullを除外して返す
    return details.filter((detail): detail is SubsidyDetail => detail !== null);
  }
}
