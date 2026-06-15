package com.dacos.common;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.dacos.common.mapper.CommonMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ibm.icu.text.SimpleDateFormat;
import com.ibm.icu.util.Calendar;

@Service
public class CommonService {

    private static final Logger logger = LoggerFactory.getLogger(CommonService.class);

    private final CommonRepository common;
    private final CommonMapper commonMapper;
	private final ObjectMapper objectMapper;

    public CommonService(CommonRepository common, CommonMapper commonMapper, ObjectMapper objectMapper) {
        this.common = common;
        this.commonMapper = commonMapper;
        this.objectMapper = objectMapper;
    }
	
    boolean gbED = true;
    boolean gbCarLog = true;
    String gsException = "Y";
    int giTimeOut = 300000;
	
	private static final String SECRET_KEY = "mysecretkey12345";
    private static final String IV_STRING = "myivstring123456";
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";

    public int sendSms(Map<String, Object> param) {
        Map<String, Object> smsParam = new HashMap<>();

        if (param != null) {
            smsParam.putAll(param);
        }

        String dstaddr = firstNonBlank(smsParam, "PAY_HP_NO", "DSTADDR", "MPHONE_NO", "PHONE_NO", "TEL_NO");
        String text = firstNonBlank(smsParam, "TEXT", "SMS_TEXT", "MSG_TEXT");
        String msgType = firstNonBlank(smsParam, "MSG_TYPE");

        if (dstaddr.isBlank()) {
            throw new BusinessException("SMS 수신자 번호가 필요합니다.");
        }

        if (text.isBlank()) {
            throw new BusinessException("SMS 내용이 필요합니다.");
        }

        if (msgType.isBlank()) {
            throw new BusinessException("SMS 메시지 유형(MSG_TYPE)이 필요합니다.");
        }

        smsParam.put("PAY_HP_NO", dstaddr);
        smsParam.put("TEXT", text);
        smsParam.put("MSG_TYPE", msgType);
        
        if (!"10.109.111.40".equals(getServerAddress("IP"))) {
        	// 개발에선 문자가 안나가니 운영에 넣어보기
        	return common.insert(smsParam, "insertSmsSendReal");        	
        }         
        return common.insert(smsParam, "insertSmsSend");
    }

    private String firstNonBlank(Map<String, Object> param, String... keys) {
        if (param == null || keys == null) {
            return "";
        }

        for (String key : keys) {
            Object value = param.get(key);
            if (value != null && !String.valueOf(value).isBlank()) {
                return String.valueOf(value).trim();
            }
        }

        return "";
    }

 // AES 암호화
    public String encrypt(String plainText) throws Exception {

        // 암호화 미사용 시 원문 반환
        if (!gbED) return plainText;

        if (plainText == null || plainText.isBlank()) {
            return "";
        }

        // Cipher 생성
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        // AES Key 생성
        SecretKeySpec secretKeySpec = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "AES"); 
        // IV 생성
        IvParameterSpec ivParameterSpec = new IvParameterSpec(IV_STRING.getBytes(StandardCharsets.UTF_8)); 

        // 암호화 초기화
        cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, ivParameterSpec);
        // 암호화 수행
        byte[] encryptedBytes = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
        // Base64 문자열 변환 후 반환
        return Base64.getEncoder().encodeToString(encryptedBytes);
    }

    // AES 복호화
    public String decrypt(String encryptedText) throws Exception {

        // 암호화 미사용 시 원문 반환
        if (!gbED) return encryptedText;

        if (encryptedText == null || encryptedText.isBlank()) {
            return encryptedText;
        }

        // Base64 형식 아니면 원문 반환
        if (!isBase64Encoded(encryptedText)) {
            return encryptedText;
        }

        // AES Key 생성
        SecretKeySpec secretKeySpec = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "AES");
        // IV 생성
        IvParameterSpec ivParameterSpec = new IvParameterSpec(IV_STRING.getBytes(StandardCharsets.UTF_8));
        // Cipher 생성
        Cipher cipher = Cipher.getInstance(ALGORITHM);

        // 복호화 모드 초기화
        cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, ivParameterSpec);

        try {

            // Base64 디코딩 후 복호화
            byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(encryptedText));
            // 문자열 변환 후 반환
            return new String(decryptedBytes, StandardCharsets.UTF_8);

        } catch (Exception e) {
            // 복호화 실패 시 원문 반환
            return encryptedText;
        }
    }
    
    // Base64 문자 집합과 패딩 규칙을 포함하는 정규식
    private static final Pattern BASE64_PATTERN = Pattern.compile("^[a-zA-Z0-9+/]*={0,2}$");

    public static boolean isBase64Encoded(String str) {
        // 1. 문자열이 null이거나 비어 있으면 false 반환
    	str = str.trim();
        if (str == null || "".equals(str)) {
            return false;
        }

        // 2. Base64 문자 집합과 길이 규칙(4의 배수)을 따르는지 정규식으로 확인
        // 정규식: ^[a-zA-Z0-9\\+/]*={0,2}$
        // - `^` : 문자열 시작
        // - `[a-zA-Z0-9\\+/]*` : Base64 문자가 0회 이상 반복
        // - `={0,2}` : 패딩 문자인 `=`가 0~2회 등장
        // - `$` : 문자열 끝
        if (!BASE64_PATTERN.matcher(str).matches()) {
            return false;
        }

        // 3. 디코딩 시도 (가장 확실한 판별 방법)
        try {
            // 디코딩을 시도하여 예외가 발생하지 않으면 Base64로 간주        	
        	Base64.getDecoder().decode(str);
            return true;
        } catch (IllegalArgumentException e) {
            // 디코딩 실패 시 Base64가 아님
            return false;
        }
    } 

    // jsonObject가 단건인지 다건인지 파악하여 처리
    public void processCarNoJsonData(JsonNode jsonObject) {
        
        try {
            // 1. 단건/복수 데이터 추출
        	List<JsonNode> dataList = extractDataNodes(jsonObject);

            // 2. 데이터 리스트 처리 
            for (JsonNode dataJson : dataList) {
                processSingleData(dataJson);
            }
        } catch (Exception e) {
            System.err.println("JSON 데이터 처리 중 오류 발생: " + e.getMessage());
        }
    }
    
    // JSON 구조에 따라 데이터 노드를 추출 (단건 또는 SEND_DATA 배열)
    private List<JsonNode> extractDataNodes(JsonNode rootJson) {
    	List<JsonNode> nodes = new ArrayList<>();

        JsonNode sendData = rootJson.path("SEND_DATA");

        // SEND_DATA가 배열이면
        if (sendData.isArray()) {

            for (JsonNode item : sendData) {
                nodes.add(item);
            }
        } else {
            // 단건 처리
            nodes.add(rootJson);
        }
        
        return nodes;
    }
    
    // 단일 JSONObject를 처리하여 DB에 병합(MERGE)
    private void processSingleData(JsonNode dataJson) {
        // 3. CAR_NO가 없는 경우는 무시
    	if (!dataJson.has("CAR_NO")) {
            return;
        }

        // null 체크 및 값 추출
    	String carNo = dataJson.path("CAR_NO").asText("");
    	
        // 나머지 필드는 null 가능
        String sGovtID = dataJson.has("GOVT_ID") ? dataJson.path("GOVT_ID").asText() : null;
        String sCompanyID = dataJson.has("COMPANY_ID") ? dataJson.path("COMPANY_ID").asText() : null;
        
        Map<String, Object> paramMap = new HashMap<String, Object>();
        paramMap.put("CAR_NO", carNo.trim());
        paramMap.put("GOVT_ID", sGovtID);
        paramMap.put("COMPANY_ID", sCompanyID);

        try {
            common.insert(paramMap, "insertCarDailyLog");
        } catch (Exception e) {
            System.err.println("ts_car_daily_log 처리 중 DB 오류 발생 (CAR_NO: " + carNo + "): " + e.getMessage());
        }
    }
    
	// 여러줄의 데이터를 보내야 할 때 사용, 관청도 추가
    public JsonNode linkServer(Map<String, Object> hmRequestData) {
    	logger.info("linkServer로 넘어옴 >>" + hmRequestData);
        JsonNode jsonData =
            objectMapper.valueToTree(hmRequestData);
        
        return connectLinkServer(jsonData);
    }
	
	// IP나 HOST 구하기
	public String getServerAddress(String sGubun) {
		InetAddress ip = null;
		try {
		  ip = InetAddress.getLocalHost();
		} catch (UnknownHostException e) {
		  e.printStackTrace();
		}
		return ("IP".equals(sGubun) ? ip.getHostAddress() : ip.getHostName());
	}
	
	public String getCodeDetail(String groupId, String codeId) {

	    Map<String, Object> param = new HashMap<String, Object>();

	    param.put("GROUP_ID", groupId);
	    param.put("CODE_ID", codeId);

	    List<Map<String, Object>> result =
	        common.selectList(param, "selectCodeDetail");

	    return getListData(result, 0, "DETAIL_NM");
	}
	
    // 관청서버로 데이터 송 수신
    public JsonNode connectLinkServer(JsonNode jSendData) {
    	logger.info("[LINK] 연계 시작");
        InetAddress ip = null; 
        int iTimeout = 300000; // 기본 5분

        try { 
            ip = InetAddress.getLocalHost();
        } catch (UnknownHostException e) { 
            e.printStackTrace(); 
        }
        
        // 1. 부산 정보 조회 (DB 조회 후 세퍼레이터 split)
        String[] sBusan = getCodeDetail("TUSE", "BUSAN").split("~");
        
	    // 2. 관청 코드(GOVT_ID) 판별
        // 값이 없으면 기본값 HAMYA 사용
	    String govtId = jSendData.path("GOVT_ID").asText("HAMYA");
	    
		// 운영 서버 여부
		boolean isProd = ip.getHostAddress().startsWith("10.109.111.40");  // 웹이 동작할 서버는 10.109.111.40

		// 부산 관청 여부
		boolean isBusan = "BUSAN".equals(govtId);
	     
        if (isBusan) {
            logger.debug("부산정보 : " + sBusan[0] + " / " + sBusan[1] + " / " + sBusan[2]);
        }
        
        // 3. 서버 환경(운영 vs 개발/로컬) 및 관청별 URL 설정
        // 기본 함양 URL로 초기화 후 조건에 따라 변경
        String sGLinkUrl = "http://192.168.0.100:9900/RealLink/linkServer.do";

        if (isProd) {

            if ("CHANG".equals(govtId)) {
                sGLinkUrl = "http://192.168.2.100:9900/RealLink/linkServer.do";
            } else if ("HAMAN".equals(govtId)) {
                sGLinkUrl = "http://192.168.3.100:9900/RealLink/linkServer.do";
            } else if ("DAEGU".equals(govtId)) {
                sGLinkUrl = "http://152.99.22.97:9900/RealLink/relayServer.do";
            } else if (isBusan) {
                sGLinkUrl = sBusan[0];
            }

        } else {
            sGLinkUrl = "http://link.dcross.kr/relayServer2.do";
            if (isBusan) {
                sGLinkUrl = sBusan[0];
            } 
            iTimeout = 3000000;
        }
        
        logger.info("govtId : {}", govtId);
        logger.info("[LINK] URL : {}", sGLinkUrl);
        logger.debug("SERVER IP : " + ip.getHostAddress());
        
        String sReturnCode = "";
        String sReturnMsg = "";

        try {
        	
            Calendar calendar = Calendar.getInstance();
            
            int iYoil = calendar.get(Calendar.DAY_OF_WEEK);
            int iTime = calendar.get(Calendar.HOUR_OF_DAY);
            int currentDay = calendar.get(Calendar.DAY_OF_MONTH);

            // 현재 날짜를 "yyyyMMdd" 형식으로 저장 (예: 20240630)
            String str = new SimpleDateFormat("yyyyMMdd").format(new Date());
            
            // 차세대 변환에 따른 마감일 타임아웃 강제 세팅 로직
            if ("N".equals(gsException)) {          
                giTimeOut = 0;
            } else if (currentDay == 1 && "Y".equals(gsException)) {
                giTimeOut = 300000;
            }
            
	        String sid = jSendData.path("SID").asText();
	        logger.debug("SID : " + sid);
				
	        // 연계통신 타임아웃 별도 조회 및 설정
			if (sid.startsWith("DL_")) {
			    iTimeout = Integer.parseInt(getCodeDetail("ETC..", "TOUTL"));
			    logger.debug("연계통신 관련 타임아웃 설정 " + iTimeout + " / " + sid);
			}
         
            if (giTimeOut != 0) {
            	
                if (gbCarLog) {
                    processCarNoJsonData(jSendData);
                }
                
                // ==================== [경로 A] 부산 통신 (HTTPS) ====================
                if (isBusan) {
                	
                    logger.info("[LINK] 부산 HTTPS 연계 시작");
                    // SSL Keystore 설정
                    if (isProd) {
                        System.setProperty("javax.net.ssl.trustStore", "/app/resources/ssl/busankeystore.jks");
                    } else {
                        System.setProperty("javax.net.ssl.trustStore", "d:\\ssl\\busankeystore.jks");
                    }
                    System.setProperty("javax.net.ssl.trustStorePassword", "dacos123!@#");        

                    // SSL 소켓 팩토리 설정 (DB에서 받아온 프로토콜 사용)
                    SSLContext sslContext = SSLContext.getInstance(sBusan[1]);
                    sslContext.init(null, null, null);
                    SSLSocketFactory socketFactory = sslContext.getSocketFactory();

                    String sSendData = objectMapper.writeValueAsString(jSendData);
                    
                    logger.info("[LINK] 요청 데이터 생성 완료");

                    sSendData = sSendData.replace("&", "ø").replace("%", "‰");
                    logger.debug("https 보낼데이터 > : " + sSendData);
                    
                    // 최대 10회 재시도 루프
                    int iCnt = 0;
                    
                    while (true) {
                    	
                        iCnt++;
                        
                        logger.info("[LINK] 전송 시도 횟수 : {}", iCnt);
                        
                        if (iCnt > 10) {
                        	throw new RuntimeException("10번 이상 시도해서 강제 예외 발생시킴"); 
                        }
                        
                        HttpsURLConnection conn = null;
                        try {
                            conn = openBusanHttpsConnection(sGLinkUrl, sBusan[2], socketFactory, iTimeout);

                            // 요청 데이터 전송
                            try (PrintWriter pw = new PrintWriter(new OutputStreamWriter(conn.getOutputStream(), StandardCharsets.UTF_8))) 
                            {
                                pw.write("reqData=" + sSendData);
                                pw.flush();
                                
                                logger.info("[LINK] 관청 서버 전송 완료");
                            }
                            
                            logger.info("[LINK] 응답 수신 시작");
                            
                            int responseCode = conn.getResponseCode();
                            // 응답 데이터 수신
                            try (BufferedReader reader = new BufferedReader(new InputStreamReader(getResponseStream(conn), StandardCharsets.UTF_8))) 
                            {
                                StringBuilder buffer = new StringBuilder();
                                
                                String line = null;
                                
                                // 응답 데이터 한 줄씩 읽기
                                while ((line = reader.readLine()) != null) {
                                    buffer.append(line).append("\r\n");
                                }
                                
                                logger.info("[LINK] 응답 수신 완료, responseCode: {}", responseCode);
                                
                                if (responseCode < HttpURLConnection.HTTP_OK || responseCode >= HttpURLConnection.HTTP_MULT_CHOICE) {
                                    throw new IOException("Busan link server returned HTTP " + responseCode + ": " + buffer);
                                }
                                
                                // 통신 성공
                                sReturnCode = "0";
                                sReturnMsg = buffer.toString();
                            }
                        } catch (IOException e) {
                            logger.warn("[LINK] Busan HTTPS request failed. attempt: {}/10, url: {}, message: {}", iCnt, sGLinkUrl, e.getMessage());
                            if (iCnt >= 10) {
                                throw e;
                            }
                            continue;
                        } finally {
                            if (conn != null) {
                                conn.disconnect();
                            }
                        }
                        // 성공 시 반복 종료
                        break;
                    }
                    
                    logger.info("[LINK] 부산 HTTPS 연계 종료");

                // ==================== [경로 B] 일반 관청 통신 (HTTP) ====================
                } else {
                	
                	logger.info("[LINK] 일반 HTTP 연계 시작");
                	
                	HttpURLConnection httpCon = (HttpURLConnection) URI.create(sGLinkUrl).toURL().openConnection();
                	httpCon.setDoOutput(true);
                	httpCon.setRequestMethod("POST");
                	httpCon.setReadTimeout(iTimeout);
                	httpCon.setConnectTimeout(iTimeout);
                	
                	logger.info("[LINK] URL : {}", sGLinkUrl);
                    
                    String sSendData = jSendData.toString();
                    logger.debug("보낼데이터 : " + sSendData);
                    
                    // 데이터 암호화 및 특수문자 치환
                    sSendData = encrypt(sSendData);
                    logger.info("[LINK] 데이터 암호화 완료");
                    
                    sSendData = sSendData.replace("&", "ø").replace("%", "‰").replace("+", "û");    
                    
                    logger.info("[LINK] 관청 서버 전송 시작");
					
					try (PrintWriter pw = new PrintWriter(new OutputStreamWriter(httpCon.getOutputStream(), StandardCharsets.UTF_8))) {
					    pw.write("reqData=" + sSendData);
					    pw.flush();
					    logger.info("[LINK] 관청 서버 전송 완료");
					}
                    
					logger.info("[LINK] 응답 수신 시작");
					
	                try (BufferedReader reader = new BufferedReader(new InputStreamReader(httpCon.getInputStream(), StandardCharsets.UTF_8))) 
	                {
	                    StringBuilder buffer = new StringBuilder();

	                    String line = null;

	                    while ((line = reader.readLine()) != null) {
	                        buffer.append(line);
	                    }
	                    
	                    logger.info("[LINK] 응답 수신 완료");

	                    sReturnCode = "0";

	                    sReturnMsg = buffer.toString().replaceAll("\\r\\n", "");
	                    
	                    logger.info("[LINK] 응답 데이터 변환 완료");
	                    
	                    httpCon.disconnect();
	                    
	                    logger.info("[LINK] 일반 HTTP 연계 종료");
	                }
                }
            } else {
                logger.debug("강제 타임아웃 처리");
                sReturnCode = "-1";
                sReturnMsg = "{'returnLinkServer': {'code':'-1', 'message':'국토부 자동차 원부 연계 시스템 점검'}}";
            }
                
            // 결과 JSON 파싱 및 복호화
            JsonNode jsonTemp = objectMapper.readTree(sReturnMsg);
            
            sReturnMsg = jsonTemp.path("returnLinkServer").asText();
            
            sReturnMsg = decrypt(sReturnMsg);    
            
            logger.info("sReturnMsg 복호화 완료 >>" + sReturnMsg);
            
        } catch (SocketTimeoutException e) { 
            logger.debug("타임아웃 에러 : " + e.toString());
            sReturnCode = "-2";
            sReturnMsg = "";
        } catch(Exception e) {
            logger.debug("통신 에러 : " + e.toString());
            sReturnCode = "-1";
            sReturnMsg = "국토부 자동차 원부 연계 시스템 점검중";
        }
        
        ObjectNode jsonReturn = objectMapper.createObjectNode();

        jsonReturn.put("errorCode", sReturnCode);
        jsonReturn.put("returnMSG", sReturnMsg);

        logger.debug("sReturnCode : " + sReturnCode + " / sReturnMsg : " + sReturnMsg);

        return jsonReturn;
    }
    
	// List에서 특정 행에 있는 데이터 컬럼값 가져오기
    public String getListData(List<Map<String, Object>> list, int row, String field) {

        String sReturn = "";

        try {
            Map<String, Object> map = list.get(row);
            sReturn = String.valueOf(map.get(field));

        } catch (Exception e) {
            logger.debug("getListData 처리시 오류 : " + field + " / " + e.getMessage());
            sReturn = "";
        }

        return sReturn;
    }
    
	// JsonNode, ObjectNode(JSONObject 형식) 데이터를 받아 마이플랫폼에 넘길 List 형식으로 변환
	public List<Map<String, Object>> setJsonObjectToList(JsonNode jsonData) {
	
	    List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
	    Map<String, Object> resultMap = new HashMap<String, Object>();
	
	    Iterator<Map.Entry<String, JsonNode>> fields = jsonData.fields();
	
	    while (fields.hasNext()) {
	
	        Map.Entry<String, JsonNode> entry = fields.next();
	
	        String key = entry.getKey();
	
	        Object value = entry.getValue().isNull()
	            ? ""
	            : entry.getValue().asText();
	
	        resultMap.put(key, value);
	    }
	
	    result.add(resultMap);
	
	    return result;
	}
	
    private HttpsURLConnection openBusanHttpsConnection(
        String linkUrl,
        String method,
        SSLSocketFactory socketFactory,
        int timeout
    ) throws IOException {
        URI uri = URI.create(linkUrl);
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IOException("Busan link URL must use HTTPS: " + linkUrl);
        }

        HttpsURLConnection conn = (HttpsURLConnection) uri.toURL().openConnection();
        conn.setDoOutput(true);
        conn.setRequestMethod(method);
        conn.setSSLSocketFactory(socketFactory);
        conn.setReadTimeout(timeout);
        conn.setConnectTimeout(timeout);
        return conn;
    }

    private InputStream getResponseStream(HttpURLConnection conn) throws IOException {
        InputStream errorStream = conn.getErrorStream();
        if (conn.getResponseCode() >= HttpURLConnection.HTTP_BAD_REQUEST && errorStream != null) {
            return errorStream;
        }
        return conn.getInputStream();
    }
	

}
