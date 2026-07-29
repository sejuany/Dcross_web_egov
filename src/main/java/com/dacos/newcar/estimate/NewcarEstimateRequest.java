package com.dacos.newcar.estimate;

import java.util.HashMap;
import java.util.Map;

import lombok.Data;

/**
 * 신규등록 예상금액 요청.
 * 화면에서 아직 저장하지 않은 값을 우선 사용하기 위해 현재 데이터셋을 그대로 받는다.
 */
@Data
public class NewcarEstimateRequest {

    private Map<String, Object> dsService = new HashMap<>();
    private Map<String, Object> dsNewCar = new HashMap<>();
}
