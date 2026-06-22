import HomePage from '../pages/HomePage';
import Dashboard from '../components/dashboard/Dashboard';

import MortgageRegistration from '../components/mortgage/MortgageRegistration';
import MortRegRequest from '../components/mortgage/MortRegRequest';
import MortRegList from '../components/mortgage/MortRegList';
import BeforehandDsign from '../components/mortgage/BeforehandDsign';
import MortRegConfirmList from '../components/mortgage/MortRegConfirmList';
import RegistConfirm from '../components/mortgage/RegistConfirm';
import MortChange from '../components/mortgage/MortChange';
import MortChangeList from '../components/mortgage/MortChangeList';
import CorrectionInfo from '../components/mortgage/CorrectionInfo';
import DelayList from '../components/mortgage/DelayList';

import MortErsRequest from '../components/mortgageerase/MortErsRequest';
import MortErsList from '../components/mortgageerase/MortErsList';
import MortErsGroupRequest from '../components/mortgageerase/MortErsGroupRequest';

import CeMortRegRequest from '../components/constructequip/CeMortRegRequest';
import CeMortRegList from '../components/constructequip/CeMortRegList';
import CeMortErsRequest from '../components/constructequip/CeMortErsRequest';
import CeMortErsList from '../components/constructequip/CeMortErsList';
import CeMortErsGroupRequest from '../components/constructequip/CeMortErsGroupRequest';

import NewcarRequest from '../components/newcar/NewcarRequest';
import NewcarList from '../components/newcar/NewcarList';
import NewCarGroupRequest from '../components/newcar/NewCarGroupRequest';
import Epayconfirm from '../components/newcar/Epayconfirm';
import NotUsedBond from '../components/newcar/NotUsedBond';
import NewcarPDFUpload from '../components/newcar/NewcarPDFUpload';

import TrnsNameRequest from '../components/trnsname/TrnsNameRequest';
import TrnsNameList from '../components/trnsname/TrnsNameList';
import TotalGroupRequest from '../components/trnsname/TotalGroupRequest';
import CarpRequestList from '../components/trnsname/CarpRequestList';
import TrnsNumChangeList from '../components/trnsname/TrnsNumChangeList';
import OfflineList from '../components/trnsname/OfflineList';

import WonbuScrapRequest from '../components/addservice/WonbuScrapRequest';
import CarMileageList from '../components/addservice/CarMileageList';
import Car365priceList from '../components/addservice/Car365priceList';
import InsuranceManage from '../components/addservice/InsuranceManage';
import CarSise from '../components/addservice/CarSise';
import CarZenMapping from '../components/addservice/CarZenMapping';

import PayInfo from '../components/payment/PayInfo';
import TvbankManage from '../components/payment/TvbankManage';
import SellingInfo from '../components/payment/SellingInfo';
import PointManage from '../components/payment/PointManage';
import NotPayInfo from '../components/payment/NotPayInfo';
import PayReturnInfo from '../components/payment/PayReturnInfo';
import InjiseManage from '../components/payment/InjiseManage';
import EPayInfo from '../components/payment/EPayInfo';
import PaymentTotalList from '../components/payment/TotalList';

import NumberPlateList from '../components/numplate/NumberPlateList';
import CarPaperManage from '../components/numplate/CarPaperManage';
import TemporaryNumPlate from '../components/numplate/TemporaryNumPlate';
import NumPlateSupplyManage from '../components/numplate/NumPlateSupplyManage';
import NumPlateSupplyList from '../components/numplate/NumPlateSupplyList';

import CodeManage from '../components/common/CodeManage';
import BoardManage from '../components/common/BoardManage';
import MenuManage from '../components/common/MenuManage';
import LoginLogList from '../components/common/LoginLogList';
import SearchLogList from '../components/common/SearchLogList';
import DataLinkTest from '../components/common/DataLinkTest';
import AccountHistoryList from '../components/common/AccountHistoryList';
import ServerApply from '../components/common/ServerApply';
import AdminTotalList from '../components/common/TotalList';

import CompanyManage from '../components/company/CompanyManage';
import CompanyUserManage from '../components/company/CompanyUserManage';
import NumplateDeliveryManage from '../components/company/NumplateDeliveryManage';
import CompanyNew from '../components/company/CompanyNew';

import MemberPasswordCheck from '../components/member/MemberPasswordCheck';
import MemberEdit from '../components/member/MemberEdit';

export const protectedRouteComponents = {
    '/home': HomePage,
    '/registration': Dashboard,

    '/mortgage/registration': MortgageRegistration,
    '/mortgage/mort-reg-request': MortRegRequest,
    '/mortgage/mort-reg-list': MortRegList,
    '/mortgage/beforehand-dsign': BeforehandDsign,
    '/mortgage/mort-reg-confirm': MortRegConfirmList,
    '/mortgage/regist-confirm': RegistConfirm,
    '/mortgage/mort-change': MortChange,
    '/mortgage/mort-change-list': MortChangeList,
    '/mortgage/correction-info': CorrectionInfo,
    '/mortgage/delay-list': DelayList,

    '/mortgageerase/mort-ers-request': MortErsRequest,
    '/mortgageerase/mort-ers-list': MortErsList,
    '/mortgageerase/mort-ers-group-request': MortErsGroupRequest,

    '/constructequip/ce-mort-reg-request': CeMortRegRequest,
    '/constructequip/ce-mort-reg-list': CeMortRegList,
    '/constructequip/ce-mort-ers-request': CeMortErsRequest,
    '/constructequip/ce-mort-ers-list': CeMortErsList,
    '/constructequip/ce-mort-ers-group': CeMortErsGroupRequest,

    '/newcar/newcar-request': NewcarRequest,
    '/newcar/newcar-list': NewcarList,
    '/newcar/newcar-group-request': NewCarGroupRequest,
    '/newcar/epayconfirm': Epayconfirm,
    '/newcar/not-used-bond': NotUsedBond,
    '/newcar/pdf-upload': NewcarPDFUpload,

    '/trnsname/trnsname-request': TrnsNameRequest,
    '/trnsname/trnsname-list': TrnsNameList,
    '/trnsname/total-group-request': TotalGroupRequest,
    '/trnsname/carp-request-list': CarpRequestList,
    '/trnsname/trns-num-change': TrnsNumChangeList,
    '/trnsname/offline-list': OfflineList,

    '/addservice/wonbu-scrap-request': WonbuScrapRequest,
    '/addservice/car-mileage-list': CarMileageList,
    '/addservice/car365-price-list': Car365priceList,
    '/addservice/insurance-manage': InsuranceManage,
    '/addservice/car-sise': CarSise,
    '/addservice/car-zen-mapping': CarZenMapping,

    '/payment/pay-info': PayInfo,
    '/payment/tvbank-manage': TvbankManage,
    '/payment/selling-info': SellingInfo,
    '/payment/point-manage': PointManage,
    '/payment/not-pay-info': NotPayInfo,
    '/payment/pay-return-info': PayReturnInfo,
    '/payment/injise-manage': InjiseManage,
    '/payment/epay-info': EPayInfo,
    '/payment/total-list': PaymentTotalList,

    '/numplate/number-plate-list': NumberPlateList,
    '/numplate/car-paper-manage': CarPaperManage,
    '/numplate/temporary-num-plate': TemporaryNumPlate,
    '/numplate/num-plate-supply-manage': NumPlateSupplyManage,
    '/numplate/num-plate-supply-list': NumPlateSupplyList,

    '/admin/code-manage': CodeManage,
    '/admin/board-manage': BoardManage,
    '/admin/menu-manage': MenuManage,
    '/admin/login-log-list': LoginLogList,
    '/admin/search-log-list': SearchLogList,
    '/admin/data-link-test': DataLinkTest,
    '/admin/account-history': AccountHistoryList,
    '/admin/server-apply': ServerApply,
    '/admin/total-list': AdminTotalList,

    '/company/company-manage': CompanyManage,
    '/company/company-user-manage': CompanyUserManage,
    '/company/numplate-delivery-manage': NumplateDeliveryManage,
    '/company/company-new': CompanyNew,

    '/mypage/member-password-check': MemberPasswordCheck,
    '/mypage/member-edit': MemberEdit,
};
