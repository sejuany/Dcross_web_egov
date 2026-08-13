package com.dacos.attach;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.attach.mapper.AttachMapper;
import com.dacos.attach.pdf.LocalTaxExemptionPdfCreator;
import com.dacos.attach.pdf.PdfExemptionDto;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.customer.CustomerService;

import lombok.RequiredArgsConstructor;


/**
 * 신차 등록 서비스
 * - getNewCarList: Map으로 반환하여 컬럼명 그대로 프론트에 전달 (직렬화 문제 방지)
 */
@RequiredArgsConstructor
@Service
public class AttachService {

    private static final Logger logger = LoggerFactory.getLogger(AttachService.class);
    // DB 저장 경로
    private static final String WA_ATTACH_PATH_NM = "/upload";
    private static final long WA_ATTACH_MAX_SIZE = 10L * 1024L * 1024L;
    
    private final AttachMapper attachMapper;
    private final CustomerService customerService;
    private final CommonRepository common; // DB 접근 역할
    
    /**
	 * 첨부파일 목록 조회
	 */
	public List<Map<String, Object>> getAttachFiles(String serviceId, String token, UserDto user) {
		
		serviceId = resolveServiceId(serviceId, token, user);
		
	    String cleanServiceId = Objects.toString(serviceId, "").trim();

	    if (cleanServiceId.isBlank()) {
	        throw new BusinessException("접수번호가 없습니다.", 400);
	    }

	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", cleanServiceId);

	    List<Map<String, Object>> list = attachMapper.getAttachFiles(param);
	    
	    String prefix = cleanServiceId + "_";


	    for (Map<String, Object> file : list) {

	        // 파일 URL
	    	file.put("FILE_URL", buildAttachFileUrl(file, token));

	        // 서버 저장 파일명
	        // {서비스아이디}_{파일코드}.{확장자}
	        // 예) N010-260710-43600_OWNER_ID.jpg
	        String serverFileName = Objects.toString(file.get("ATCHSVRFILE_NM"), "");

	        String code = "";

	        if (serverFileName.startsWith(prefix)) {

	            code = serverFileName.substring(prefix.length());

	            int dotIndex = code.lastIndexOf('.');

	            if (dotIndex > -1) {
	                code = code.substring(0, dotIndex);
	            }
	        }

	        file.put("CODE", code);
	    }
	    logger.info("list>>"+list);
	    return list;
	}
    
	/**
	 * 서버 IP 또는 Host명 조회
	 */
	public String getServerAddress(String sGubun) {
		InetAddress ip = null;
		try {
		  ip = InetAddress.getLocalHost();
		} catch (UnknownHostException e) {
		  e.printStackTrace();
		}
		return ("IP".equals(sGubun) ? ip.getHostAddress() : ip.getHostName());
	}
    
	/**
	 * 첨부파일 저장 루트 경로 조회
	 */
	private String getAttachUploadRoot() {

	    String serverIp = getServerAddress("IP");

	    // 운영 WAS2
	    if ("10.109.111.40".equals(serverIp)) {
	        return "/web/upload";
	    }
	    
	    logger.info("serverIp = {}", serverIp);
	    
        // 로컬
        if ("127.0.0.1".equals(serverIp)
        		|| "169.254.242.223".equals(serverIp)
                || "localhost".equalsIgnoreCase(serverIp)) {
        	return "C:\\Users\\다코스\\Downloads\\uploadTest";
        }

	    // 개발
	    return "D:\\webapps\\DaCOS\\upload";
	}

	/**
	 * 첨부파일 업로드 전체 경로 생성
	 */
	public Path getAttachFilePath(String fileName) {
	    return Paths.get(getAttachUploadRoot())
	            .resolve(fileName)
	            .normalize();
	}

	/**
	 * 양식 다운로드
	 */
	public Resource getFormFile(Map<String, Object> param) {

	    String name = (String) param.get("NAME");
	    
	    // attachDoc.jsp의 name에 있는 파일명으로 조회 후 다운
	    String fileName = name + ".pdf";

	    Path path = Paths.get(getFormRoot()).resolve(fileName);
		
		if (!Files.exists(path) || !Files.isRegularFile(path)) {
		    throw new BusinessException("양식 파일이 없습니다.", 404);
		}

	    return new FileSystemResource(path);
	}
		
	
	/*
	 * 양식 파일 저장 루트 경로 조회
	 */
	private String getFormRoot() {

	    String serverIp = getServerAddress("IP");

	    // 운영 WAS2
	    if ("10.109.111.40".equals(serverIp)) {
	        return "/web/forms";
	    }
	    
	    logger.info("serverIp = {}", serverIp);
	    
        // 로컬
        if ("127.0.0.1".equals(serverIp)
        		|| "169.254.242.223".equals(serverIp)
                || "localhost".equalsIgnoreCase(serverIp)) {
        	return "C:/Users/다코스/Downloads/forms";
        }

	    // 개발
	    return "D:\\webapps\\DaCOS\\forms";
	}

	/**
	 * 첨부파일 업로드 및 DB 저장
	 * 파라미터값 변경하면 두 군데 수정해야 됨
	 * 신규등록 첨부파일 업로드 - /api/newcar/wa-attach-upload
	 * 고객 첨부파일 업로드 - /api/customer/file/upload
	 */
	@Transactional
	public List<Map<String, Object>> uploadAttachFile(
	        String serviceId, String code, String gubun, 
	        String duplicateMinor, String docName,
	        MultipartFile file, UserDto user, String token
	) {
		
	    // 관리자면 serviceId 사용
	    // 고객이면 token으로 SERVICE_ID 조회
	    serviceId = resolveServiceId(serviceId, token, user);

	    String cleanServiceId = Objects.toString(serviceId, "").trim();
	    String cleanCode = Objects.toString(code, "").trim();
	    String cleanGubun = Objects.toString(gubun, "").trim();

	    if (cleanServiceId.isBlank()) {
	        throw new BusinessException("접수번호가 없습니다.", 400);
	    }

	    if (cleanCode.isBlank()) {
	        throw new BusinessException("첨부파일 코드가 없습니다.", 400);
	    }

	    if (cleanGubun.isBlank()) {
	        throw new BusinessException("첨부파일 구분값이 없습니다.", 400);
	    }

	    if (file == null || file.isEmpty()) {
	        throw new BusinessException("첨부파일이 없습니다.", 400);
	    }

	    if (file.getSize() > WA_ATTACH_MAX_SIZE) {
	        throw new BusinessException("첨부파일은 10MB 이하만 가능합니다.", 400);
	    }
	    
	    try {

	        // ============================
	        // 저장 파일 정보 생성
	        // ============================
	        String originalFileName = sanitizeOriginalFileName(file.getOriginalFilename());
	        String extension = getFileExtension(originalFileName);

	        // 화면에 표시할 한글 파일명
	        String koreanFileName = docName + extension;

	        // 서버 저장 파일명
	        String savedFileName =
	                cleanServiceId + "_" + cleanCode + extension;

	        String loginId = user != null
	                ? Objects.toString(user.getLOGIN_ID(), "")
	                : "CUSTOMER";

	        // ============================
	        // 업로드 폴더 생성
	        // ============================
	        // 업로드 폴더가 없으면 생성
	        Path uploadDir = Paths.get(getAttachUploadRoot());
	        Files.createDirectories(uploadDir);

	        // ============================
	        // SEQ 결정
	        // ============================
	        // 현재 가장 큰 SEQ 다음 번호 사용
	        List<Map<String, Object>> attachList =
	                getAttachFiles(cleanServiceId, token, user);

	        int seq = attachList.stream()
	                .map(m -> Objects.toString(m.get("SEQ"), ""))
	                .filter(s -> !s.isBlank())
	                .mapToInt(Integer::parseInt)
	                .max()
	                .orElse(-1) + 1;

	        // ============================
	        // 공통 파라미터 생성
	        // ============================
	        Map<String, Object> param = new HashMap<>();

	        param.put("SERVICE_ID", cleanServiceId);
	        param.put("CODE", cleanCode);           // 삭제 시 사용
	        param.put("SEQ", String.valueOf(seq));
	        param.put("ATCHFILE_NM", koreanFileName);
	        param.put("ATCHSVRFILE_NM", savedFileName);
	        param.put("ATCHFILEPATH_NM", WA_ATTACH_PATH_NM);
	        param.put("GUBUN", cleanGubun);
	        param.put("INS_USER", loginId);
	        param.put("UPD_USER", loginId);

	        // ============================
	        // 기존 첨부파일 삭제
	        // ============================
	        // 동일한 CODE의 기존 첨부파일 삭제
	        deleteOldAttachFiles(uploadDir, param);

	        if ("Y".equals(duplicateMinor) && !"MINOR".equals(cleanGubun)) {
	        	// 미성년자 확인서류 병합 대상이면 MINOR도 함께 삭제
	            param.put("GUBUN", "MINOR");
	            deleteOldAttachFiles(uploadDir, param);

	            // 원래 GUBUN 복원
	            param.put("GUBUN", cleanGubun);
	        }

	        // ============================
	        // 파일 저장
	        // ============================
	        // 서버에 실제 파일 저장
	        Path savePath = uploadDir.resolve(savedFileName).normalize();

	        file.transferTo(savePath.toFile());

	        // ============================
	        // DB 저장
	        // ============================
	        param.put("SEQ", String.valueOf(seq++));
	        param.put("GUBUN", cleanGubun);
	        attachMapper.insertAttachFile(param);

	        if ("Y".equals(duplicateMinor) && !"MINOR".equals(cleanGubun)) {
	        	// 미성년자 확인서류 병합을 위해 MINOR도 함께 저장
	            param.put("SEQ", String.valueOf(seq++));
	            param.put("GUBUN", "MINOR");
	            attachMapper.insertAttachFile(param);
	        }

	        logger.info("[WA 첨부 업로드] serviceId={}, code={}, gubun={}, duplicateMinor={}, seq={}",
	                cleanServiceId, cleanCode, cleanGubun, duplicateMinor, seq);

	    } catch (IOException e) {

	        logger.error("[NewcarService] WA 신규등록 첨부파일 저장 실패");

	        throw new BusinessException("첨부파일 저장 중 오류가 발생했습니다.", 500);
	    }

	    return getAttachFiles(cleanServiceId, token, user);
	}
	
	
	/**
	 * 기존 첨부파일 삭제 (저장 시 사용)
	 * - DB : SERVICE_ID + GUBUN + ATCHSVRFILE_NM 기준 (확장자 제외)
	 * - 파일 : ATCHSVRFILE_NM 기준 (확장자 제외)
	 */
	private void deleteOldAttachFiles(
	        Path uploadDir,
	        Map<String, Object> param) {

	    String serviceId = Objects.toString(param.get("SERVICE_ID"), "");
	    String gubun = Objects.toString(param.get("GUBUN"), "");
	    String serverFileName =
	            Objects.toString(param.get("ATCHSVRFILE_NM"), "");

	    // 확장자를 제외한 서버 파일명
	    int dotIndex = serverFileName.lastIndexOf('.');
	    String baseFileName = dotIndex > -1
	            ? serverFileName.substring(0, dotIndex)
	            : serverFileName;

	    // ===== DB 삭제 =====
	    Map<String, Object> selectParam = new HashMap<>();
	    selectParam.put("SERVICE_ID", serviceId);
	    selectParam.put("GUBUN", gubun);

	    List<Map<String, Object>> attachList =
	            attachMapper.getAttachFiles(selectParam);

	    for (Map<String, Object> row : attachList) {

	        String oldServerFileName =
	                Objects.toString(row.get("ATCHSVRFILE_NM"), "");

	        int oldDotIndex = oldServerFileName.lastIndexOf('.');
	        String oldBaseFileName = oldDotIndex > -1
	                ? oldServerFileName.substring(0, oldDotIndex)
	                : oldServerFileName;

	        if (!baseFileName.equals(oldBaseFileName)) {
	            continue;
	        }

	        Map<String, Object> deleteParam = new HashMap<>();
	        deleteParam.put("SERVICE_ID", row.get("SERVICE_ID"));
	        deleteParam.put("GUBUN", row.get("GUBUN"));
	        deleteParam.put("SEQ", row.get("SEQ"));

	        attachMapper.deleteAttachFile(deleteParam);
	    }

	    // ===== 서버 파일 삭제 =====
	    try (Stream<Path> stream = Files.list(uploadDir)) {

	        stream.filter(Files::isRegularFile)
	              .filter(path -> {
	                  String fileName = path.getFileName().toString();

	                  int index = fileName.lastIndexOf('.');
	                  String baseName = index > -1
	                          ? fileName.substring(0, index)
	                          : fileName;

	                  return baseFileName.equals(baseName);
	              })
	              .forEach(path -> {
	                  try {
	                      Files.deleteIfExists(path);
	                  } catch (IOException e) {
	                      throw new UncheckedIOException(e);
	                  }
	              });

	    } catch (IOException | UncheckedIOException e) {
	        throw new BusinessException(
	                "기존 첨부파일 삭제 중 오류가 발생했습니다.",
	                500
	        );
	    }
	}
	
	/**
	 * 첨부파일 정보 단건 조회
	 */
	public Map<String, Object> getAttachFile(
	        String serviceId,
	        String token,
	        String fileName,
	        UserDto user) {

	    serviceId = resolveServiceId(serviceId, token, user);

	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);
	    param.put("ATCHSVRFILE_NM", fileName);

	    List<Map<String, Object>> list =
	    		attachMapper.getAttachFiles(param);

	    if (list.isEmpty()) {
	        return null;
	    }

	    return list.get(0);
	}
	
	/**
	 * 첨부파일 다운로드(단건 조회)
	 * - 관리자 : serviceId 기반 조회
	 * - 고객 : token 기반으로 SERVICE_ID 조회 후 첨부파일 반환
	 */
	public ResponseEntity<Resource> viewWaAttachFile(
	        String serviceId,
	        String token,
	        String fileName,
	        UserDto user) throws IOException {

	    // 관리자(serviceId) 또는 고객(token) 기준으로 SERVICE_ID 조회
	    serviceId = resolveServiceId(serviceId, token, user);

	    String cleanServiceId = Objects.toString(serviceId, "").trim();

	    if (cleanServiceId.isBlank()) {
	        throw new BusinessException("접수번호가 없습니다.", 400);
	    }

	    // SERVICE_ID + 서버 파일명으로 첨부파일 조회
	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", cleanServiceId);
	    param.put("ATCHSVRFILE_NM", fileName);

	    List<Map<String, Object>> list =
	    		attachMapper.getAttachFiles(param);

	    if (list.isEmpty()) {
	        throw new BusinessException("파일이 존재하지 않습니다.", 404);
	    }

	    Map<String, Object> fileInfo = list.get(0);

	    // 실제 저장된 파일 경로 조회
	    String serverFileName = Objects.toString(fileInfo.get("ATCHSVRFILE_NM"), "");
	    Path path = getAttachFilePath(serverFileName);

	    if (!Files.exists(path) || !Files.isRegularFile(path)) {
	        throw new BusinessException("파일이 존재하지 않습니다.", 404);
	    }

	    // 파일 Resource 생성
	    Resource resource = new UrlResource(path.toUri());

	    // 원본 파일명
	    String originalName = Objects.toString(fileInfo.get("ATCHFILE_NM"), "");

	    // MIME 타입 자동 판별
	    String contentType = Files.probeContentType(path);

	    if (contentType == null || contentType.isBlank()) {
	        contentType = "application/octet-stream";
	    }

	    // 브라우저에서 바로 표시(inline)하도록 응답
	    return ResponseEntity.ok()
	            .contentType(MediaType.parseMediaType(contentType))
	            .header(
	                    HttpHeaders.CONTENT_DISPOSITION,
	                    ContentDisposition.inline()
	                            .filename(originalName, StandardCharsets.UTF_8)
	                            .build()
	                            .toString()
	            )
	            .body(resource);
	}

	/**
	 * 원본 파일명 정리
	 */
    private String sanitizeOriginalFileName(String fileName) {

        String value = Objects.toString(fileName, "").trim();

        if (value.isBlank()) {
            return "attach_file";
        }

        value = value.replace("\\", "/");

        int lastSlashIndex = value.lastIndexOf("/");
        if (lastSlashIndex >= 0) {
            value = value.substring(lastSlashIndex + 1);
        }

        return value.replaceAll("[\\r\\n]", "");
    }

    /**
     * 파일 확장자 추출
     */
    private String getFileExtension(String fileName) {

        String value = Objects.toString(fileName, "").trim();
        int dotIndex = value.lastIndexOf(".");

        if (dotIndex < 0) {
            return "";
        }

        return value.substring(dotIndex).toLowerCase();
    }

    /**
     * 첨부파일 조회 URL 생성
     */
    private String buildAttachFileUrl(
            Map<String, Object> file,
            String token) {

        String savedFileName = Objects.toString(file.get("ATCHSVRFILE_NM"), "").trim();

        if (savedFileName.isBlank()) {
            return "";
        }

        String encodedFileName = URLEncoder
                .encode(savedFileName, StandardCharsets.UTF_8)
                .replace("+", "%20");

        // 고객페이지
        if (token != null && !token.isBlank()) {
            return "/api/customer/file/view?token="
                    + URLEncoder.encode(token, StandardCharsets.UTF_8)
                    + "&fileName="
                    + encodedFileName;
        }

        // 관리자(WA)
        return "/api/newcar/wa-attach-view?fileName=" + encodedFileName;
    }

	/**
	 * 사용자 유형에 따른 SERVICE_ID 조회
	 */
    private String resolveServiceId(
            String serviceId,
            String token,
            UserDto user) {

        // 로그인 사용자
        if (user != null) {
            return serviceId;
        }

        // 고객페이지는 TOKEN으로 SERVICE_ID 조회
        Map<String, Object> param = new HashMap<>();
        param.put("TOKEN", token);
        		
        // 고객페이지
        Map<String, Object> info = customerService.getTokenInfo(param);

        if (info == null) {
            throw new BusinessException("유효하지 않은 링크입니다.");
        }

        return Objects.toString(info.get("SERVICE_ID"));
    }

    
    /* *******************************************************************
     * - 감면서류 PDF 생성 및 병합
     *   · CREATE_YN = Y : 감면신청서 생성 후 증빙서류 병합
     *   · CREATE_YN = N : 증빙서류만 병합
     * *******************************************************************/
    @Transactional
    public void mergePdf(String serviceId, Map<String, Object> exemption) {

    	// 감면신청서 생성 여부
		boolean createForm =
		        "Y".equals(exemption.get("CREATE_YN"));
		
		// CREATE_YN에 따라 병합 대상 조회
	    // - Y : 감면 증빙(MERGE) + 전자서명(SIGN)
	    // - N : 감면 증빙(MERGE)만
		List<Map<String, Object>> attachList =
		        createForm
		            ? getMergeAttachFiles(serviceId, "MERGE", "SIGN")
		            : getMergeAttachFiles(serviceId, "MERGE", null);

		// 생성 파일명
        String fileName =
                createForm
                    ? serviceId + "_감면신청서.pdf"
                    : serviceId + "_감면서류.pdf";

        if (attachList.isEmpty()) {
            logger.info("병합 대상 첨부파일이 없어 PDF 생성을 건너뜁니다. serviceId={}", serviceId);
            return;
        }

        // 병합할 실제 파일 조회
        List<Path> mergeFiles = getMergeFiles(attachList);
	
        // CREATE_YN이 Y이면 감면신청서를 생성한 후 병합,
        // N이면 첨부파일만 병합
        Path pdfPath = createMergePdf(
                serviceId,
                fileName,
                mergeFiles,
                createForm ? exemption : null);

        if (pdfPath == null || Files.notExists(pdfPath)) {
            logger.warn("감면신청서 PDF 생성 실패");
            return;
        }

        // 4. 서버 저장 및 DB 저장
        saveMergePdf(serviceId, pdfPath);
    }
	
    /* *******************************************************************
     * - 미성년자 확인서류 병합
     * *******************************************************************/
    @Transactional
    public void mergeMinorPdf(String serviceId) {

        // 1. 병합 대상 조회
        List<Map<String, Object>> attachList =
                getMergeAttachFiles(serviceId, "MINOR", null);

        if (attachList.isEmpty()) {
            logger.info("미성년자 확인서류가 없어 PDF 생성을 건너뜁니다. serviceId={}", serviceId);
            return;
        }

        // 2. 병합할 실제 파일 조회
        List<Path> mergeFiles = getMergeFiles(attachList);

        // 3. PDF 생성
        Path pdfPath = createMergePdf(
                serviceId,
                serviceId + "_미성년자확인서류.pdf",
                mergeFiles,
                null);

        if (pdfPath == null || Files.notExists(pdfPath)) {
            logger.warn("미성년자 확인서류 PDF 생성 실패");
            return;
        }

        // 4. 서버 저장 및 DB 저장
        saveMergePdf(serviceId, pdfPath);
    }
    
	/*
	 * 병합 대상 조회
	 */
	private List<Map<String, Object>> getMergeAttachFiles(
	        String serviceId,
	        String gubun,
	        String gubun2) {
	
	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);
	    param.put("GUBUN", gubun);
	
	    if (gubun2 != null) {
	        param.put("GUBUN2", gubun2);
	    }
	
	    return attachMapper.getAttachFiles(param);
	}
	
	/*
	 * 2. 실제 파일 조회
	 */
	private List<Path> getMergeFiles(List<Map<String, Object>> attachList) {

	    List<Path> mergeFiles = new ArrayList<>();

	    Path uploadRoot = Paths.get(getAttachUploadRoot());

	    for (Map<String, Object> row : attachList) {

	        String serverFileName =
	                Objects.toString(row.get("ATCHSVRFILE_NM"), "");

	        Path filePath = uploadRoot.resolve(serverFileName);

	        if (!Files.exists(filePath)) {
	            logger.warn("파일 없음 : {}", filePath);
	            continue;
	        }

	        mergeFiles.add(filePath);
	    }

	    if (mergeFiles.isEmpty()) {
	    	logger.info("병합할 파일이 없어 병합을 건너뜁니다.");
	    }

	    return mergeFiles;
	}
	
	/*
	 * PDF 생성 및 병합
	 * - exemption != null : 감면신청서 생성 후 병합
	 * - exemption == null : 전달받은 파일만 병합
	 */
	private Path createMergePdf(
	        String serviceId,
	        String fileName,
	        List<Path> mergeFiles,
	        Map<String, Object> exemption) {
		
		logger.info("createMergePdf?");

	    Path uploadRoot = Paths.get(getAttachUploadRoot());
	    Path pdfPath = uploadRoot.resolve(fileName);

	    // 이미지를 변환한 임시 PDF 목록
	    List<Path> tempPdfList = new ArrayList<>();

	    try {

	        // 기존 PDF 삭제
	        Files.deleteIfExists(pdfPath);

	        PDFMergerUtility merger = new PDFMergerUtility();
	        merger.setDestinationFileName(pdfPath.toString());
	        
	        logger.info("exemption?" + exemption);
	        
	        // ===============================
	        // 감면신청서 생성
	        // ===============================
	        if (exemption != null) {

	        	logger.info("pdfData 하기 전");
	            // 감면신청서 PDF 생성에 필요한 데이터 조회
	            Map<String, Object> pdfData =
	                    common.select(Map.of("SERVICE_ID", serviceId),
	                            "selectExemptionInfo");
	            
	            logger.info("pdfData >>", pdfData);
	            
	            
	            // 프론트에서 전달된 감면 정보 병합
	            if (!exemption.isEmpty()) {
	                pdfData.putAll(exemption);
	            }

	            Path signFile = null;

	            // 서명파일 찾기
	            for (Path file : mergeFiles) {

	                String name =
	                        file.getFileName().toString().toUpperCase();

	                if (name.contains("_SIGN")) {
	                    signFile = file;
	                    break;
	                }
	            }

	            // 지방세 감면 신청서 추가
	            addTaxExemptionPdf(merger, tempPdfList, pdfData, signFile);
	        }

	        // ===============================
	        // 첨부파일 병합
	        // ===============================
	        for (Path file : mergeFiles) {

	            logger.info("처리 : {}", file.getFileName());

	            String name =
	                    file.getFileName().toString().toLowerCase();

	            try {

	                // 감면신청서 생성 시에는 서명파일 제외
	                if (exemption != null && name.contains("_sign")) {
	                    continue;
	                }

	                if (name.endsWith(".pdf")) {

	                    merger.addSource(file.toFile());

	                } else {

	                    Path tempPdf = createImagePdf(file);

	                    tempPdfList.add(tempPdf);

	                    merger.addSource(tempPdf.toFile());
	                }

	                logger.info("[PDF 병합] 추가 : {}", name);

	            } catch (Exception e) {

	                logger.error("[PDF 병합] 제외 : {}", name, e);
	            }
	        }

	        logger.info("===== mergeDocuments 시작 =====");

	        merger.mergeDocuments(IOUtils.createTempFileOnlyStreamCache());

	        logger.info("===== mergeDocuments 완료 =====");

	        return pdfPath;

	    } catch (Exception e) {

	        logger.error("[PDF 병합] 생성 실패", e);

	        return null;

	    } finally {

	        for (Path temp : tempPdfList) {
	            try {
	                Files.deleteIfExists(temp);
	            } catch (IOException ignore) {
	            }
	        }
	    }
	}
	
	// 지방세 감면 신청서 추가
	private void addTaxExemptionPdf(
	        PDFMergerUtility merger,
	        List<Path> tempPdfList,
	        Map<String, Object> pdfData,
	        Path signFile) throws Exception {
		
		System.out.println("addTaxExemptionPdf");
		
		// PDF 생성에 필요한 데이터를 DTO로 변환
	    PdfExemptionDto dto = new PdfExemptionDto();

	    // 신청인 정보
	    // 비과세 대상이 공동소유자인 경우 공동소유자 정보를 넣는다.
	    if("REPRE".equals((String) pdfData.get("NTAX_WHO"))) {
	    	dto.setOWNER_NM((String) pdfData.get("OWNER_NM"));
	    	dto.setREG_NO((String) pdfData.get("REG_NO"));
	    	dto.setMPHONE_NO((String) pdfData.get("MPHONE_NO"));
	    	dto.setADDRESS((String) pdfData.get("ADDRESS"));
	    	dto.setADDRESS_DT((String) pdfData.get("ADDRESS_DT"));
	    } else {
	    	dto.setOWNER_NM((String) pdfData.get("DEBTOR_NM"));
	    	dto.setREG_NO((String) pdfData.get("DEBTOR_NO"));
	    	dto.setMPHONE_NO((String) pdfData.get("DEBTOR_TEL"));
	    	dto.setADDRESS((String) pdfData.get("DEBTOR_ADDR"));
	    	dto.setADDRESS_DT((String) pdfData.get("DEBTOR_ADDR_DT"));
	    }
	    
	    dto.setSERVICE_ID((String) pdfData.get("SERVICE_ID"));
	    dto.setCAR_NO((String) pdfData.get("CAR_NO"));
	    dto.setBIZ_NO((String) pdfData.get("BIZ_NO"));
	    dto.setREQUEST_DT((String) pdfData.get("REQUEST_DT"));
	    dto.setREASON((String) pdfData.get("REASON"));
	    dto.setDOCUMENT((String) pdfData.get("DOCUMENT"));
	    dto.setGOVT_NM((String) pdfData.get("GOVT_NM"));
	    dto.setSIGN_DT((String) pdfData.get("SIGN_DT"));

	    // 지방세 감면 신청서 PDF 생성
	    LocalTaxExemptionPdfCreator creator = new LocalTaxExemptionPdfCreator();
	    Path pdf = creator.create(dto, signFile);

	    if (pdf != null && Files.exists(pdf)) {
	        tempPdfList.add(pdf);
	        merger.addSource(pdf.toFile());
	    }
	}
	
	// 병합 전 파일을 한번 열어서 정상인지 확인(PDF)
	private boolean isValidPdf(Path file) {
	
	    try (PDDocument doc = Loader.loadPDF(file.toFile())) {
	        return true;
	    } catch (Exception e) {
	        logger.warn("손상된 PDF : {}", file);
	        return false;
	    }
	}
	
	// 병합 전 파일을 한번 열어서 정상인지 확인(이미지)
	private boolean isValidImage(Path file) {

	    try {
	        return ImageIO.read(file.toFile()) != null;
	    } catch (Exception e) {
	        return false;
	    }
	}
	
	private Path createImagePdf(Path imagePath) throws IOException {

	    BufferedImage image = ImageIO.read(imagePath.toFile());

	    if (image == null) {
	        throw new BusinessException(
	                "지원하지 않는 이미지입니다 : " + imagePath.getFileName(),
	                500
	        );
	    }

	    Path tempPdf = Files.createTempFile("merge_", ".pdf");

	    try (PDDocument document = new PDDocument()) {

	        PDPage page = new PDPage(
	                new PDRectangle(
	                        image.getWidth(),
	                        image.getHeight()
	                )
	        );

	        document.addPage(page);

	        PDImageXObject pdImage =
	                JPEGFactory.createFromImage(document, image);

	        try (PDPageContentStream stream =
	                     new PDPageContentStream(document, page)) {

	            stream.drawImage(
	                    pdImage,
	                    0,
	                    0,
	                    image.getWidth(),
	                    image.getHeight()
	            );
	        }

	        document.save(tempPdf.toFile());
	    }

	    return tempPdf;
	}
	
	/*
	 * DB 저장
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	private void saveMergePdf(
	        String serviceId,
	        Path pdfPath) {

	    // 기존 병합 PDF 삭제
	    Map<String, Object> deleteParam = new HashMap<>();
	    deleteParam.put("SERVICE_ID", serviceId);
	    deleteParam.put("GUBUN", "NWEB");
	    deleteParam.put("ATCHSVRFILE_NM", pdfPath.getFileName().toString());

	    attachMapper.deleteAttachFile(deleteParam);

	    // NWEB 마지막 SEQ 조회
	    Map<String, Object> selectParam = new HashMap<>();
	    selectParam.put("SERVICE_ID", serviceId);
	    selectParam.put("GUBUN", "NWEB");

	    List<Map<String, Object>> attachList =
	            attachMapper.getAttachFiles(selectParam);

	    int seq = attachList.stream()
	            .map(m -> Objects.toString(m.get("SEQ"), ""))
	            .filter(s -> !s.isBlank())
	            .mapToInt(Integer::parseInt)
	            .max()
	            .orElse(-1) + 1;

	    String loginId = "SYSTEM";

	    Map<String, Object> insertParam = new HashMap<>();
	    insertParam.put("SERVICE_ID", serviceId);
	    insertParam.put("SEQ", String.valueOf(seq));
	    insertParam.put("ATCHFILE_NM", pdfPath.getFileName().toString());
	    insertParam.put("ATCHSVRFILE_NM", pdfPath.getFileName().toString());
	    insertParam.put("ATCHFILEPATH_NM", WA_ATTACH_PATH_NM);
	    insertParam.put("GUBUN", "NWEB");
	    insertParam.put("INS_USER", loginId);
	    insertParam.put("UPD_USER", loginId);

	    attachMapper.insertAttachFile(insertParam);

	    logger.info("[PDF 병합] DB 저장 완료 : {}", pdfPath.getFileName());
	}
}



