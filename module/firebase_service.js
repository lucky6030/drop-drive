import Firebase_Api from "./firebase_api.js"
import UUID from "./uuid.js"
import Datetime from "./datetime.js"

/** 파이어베이스 관련 비지니스 서비스들을 일관되도록 관리하기 위해서 */
class Firebase_Service
{
  /** 현재 유저가 권한을 가지고 있는지 확인하기 위해서 */
  static async check_User_Auth()
  {
    const USER_AUTH = Firebase_Api.user_Auth()
    if(USER_AUTH == null) throw new Error("The user auth to use is not found !")
    return USER_AUTH
  }
  
  /** 파일 메타데이터 및 내용들을 업로드시키기 위해서 */
  static async upload_File(file_name, file_ext, file_url, work_dir_path, user_auth)
  { 
    const CURRENT_TIME_STR = Datetime.timezone_Date_Str()
    const FILE_UUID = UUID.get_UUID()
    await Firebase_Api.upload_To_Database(`app/${user_auth}/file_meta_datas`, {
      "file_name":file_name,
      "file_ext":file_ext,
      "file_uuid":FILE_UUID,
      "type":"file",
      "path":work_dir_path,
      "created_time":CURRENT_TIME_STR,
    })
    await Firebase_Api.upload_String_To_Storage(`${user_auth}/${FILE_UUID}`, file_url)
    return FILE_UUID
  }

  /** 주어진 정보에 매칭하는 DATA URL을 반환시킴 */
  static async file_Data_URL(file_name, file_ext, work_dir_path, user_auth)
  {
    const QUERY_RESULT_FILE_INFOS = await Firebase_Api.query_To_Database(`app/${user_auth}/file_meta_datas`,  [["where", "type", "==", "file"], ["where", "path", "==", work_dir_path], ["where", "file_name", "==", file_name], ["where", "file_ext", "==", file_ext]])
    if (QUERY_RESULT_FILE_INFOS.length == 0) throw new Error("The file to download is not searched!")
    const FILE_UUID_TO_DOWNLOAD = QUERY_RESULT_FILE_INFOS[0].file_uuid
    const DATA_URL = await Firebase_Api.string_data_From_Storage(`${user_auth}/${FILE_UUID_TO_DOWNLOAD}`)
    return DATA_URL
  }

  /** 주어진 파일과 관련된 모든 요소(메타데이터, 공유링크, 공유권한, DATA URL)들을 삭제시키기 위해서 */
  static async delete_File(file_name, file_ext, work_dir_path, user_auth)
  {
    const QUERY_RESULT_FILE_INFOS = await Firebase_Api.query_To_Database(`app/${user_auth}/file_meta_datas`, [["where", "type", "==", "file"], ["where", "path", "==", work_dir_path], ["where", "file_name", "==", file_name], ["where", "file_ext", "==", file_ext]])
    if(QUERY_RESULT_FILE_INFOS.length == 0) throw new Error("The file to delete is not searched!")
    const FILE_UUID_TO_DELETE = QUERY_RESULT_FILE_INFOS[0].file_uuid
    
    await Firebase_Api.delete_From_Storage(`${user_auth}/${FILE_UUID_TO_DELETE}`)
    await Firebase_Api.delete_From_Database(`app/global/share_links`, [["where", "file_uuid", "==", FILE_UUID_TO_DELETE]], false)
    await Firebase_Api.delete_From_Database(`app/${user_auth}/share_auths`, [["where", "file_uuid", "==", FILE_UUID_TO_DELETE]], false)
    await Firebase_Api.delete_From_Database(`app/${user_auth}/file_meta_datas`, [["where", "file_uuid", "==", FILE_UUID_TO_DELETE]])
  }

  /** 주어진 디렉토리명과 경로를 기반으로 디렉토리를 생성시키기 위해서 */
  static async create_Directory(file_name, work_dir_path, user_auth)
  {
    const CURRENT_TIME_STR = Datetime.timezone_Date_Str()
    const FILE_UUID = UUID.get_UUID()
    await Firebase_Api.upload_To_Database(`app/${user_auth}/file_meta_datas`, {
      "file_name":file_name,
      "file_ext":"",
      "file_uuid":FILE_UUID,
      "type":"directory",
      "path":work_dir_path,
      "created_time":CURRENT_TIME_STR,
    })
    return FILE_UUID
  }

  /** 주어진 디렉토리에 들어있는 파일, 폴더 관련 내용을 반환받기 위해서 */
  static async directory_File_Infos(work_dir_path, user_auth)
  {
    const QUERY_RESULT_META_DATAS = await Firebase_Api.query_To_Database(`app/${user_auth}/file_meta_datas`, [["where", "path", "==", work_dir_path]])
    const FILE_INFOS = QUERY_RESULT_META_DATAS.map((doc_result) => {
      switch(doc_result.type)
      {
        case "file" :
          return {file_name:doc_result.file_name + "." + doc_result.file_ext, type:doc_result.type, created_time:doc_result.created_time}
        case "directory" :
          return {file_name:doc_result.file_name, type:doc_result.type, created_time:doc_result.created_time}
      }
    })
    return FILE_INFOS
  }

  /** 주어진 디렉토리의 하위 디렉토리 및 파일들을 연쇄적으로 삭제하고, 현재 디렉토리까지 완전하게 삭제시키기 위해서 */
  static async delete_Directory_Recursively(directory_name, work_dir_path, user_auth)
  {
    const QUERY_RESULT_TARGET_DIRECTORY_INFOS = await Firebase_Api.query_To_Database(`app/${user_auth}/file_meta_datas`, [["where", "type", "==", "directory"], ["where", "path", "==", work_dir_path], ["where", "file_name", "==", directory_name]])
    if(QUERY_RESULT_TARGET_DIRECTORY_INFOS.length == 0) return
    const TARGET_DIRECTORY_UUID = QUERY_RESULT_TARGET_DIRECTORY_INFOS[0].file_uuid
  
    const TARGET_DIRECTORY_WORK_DIR_PATH = work_dir_path + directory_name + "/"
    const QUERY_RESULT_SUB_DIRECTORY_INFOS = await Firebase_Api.query_To_Database(`app/${user_auth}/file_meta_datas`, [["where", "type", "==", "directory"], ["where", "path", "==", TARGET_DIRECTORY_WORK_DIR_PATH]])
    for(let sub_directory_info of QUERY_RESULT_SUB_DIRECTORY_INFOS)
      await Firebase_Service.delete_Directory_Recursively(sub_directory_info.file_name, TARGET_DIRECTORY_WORK_DIR_PATH, user_auth)
    
    const QUERY_RESULT_FILE_INFOS = await Firebase_Api.query_To_Database(`app/${user_auth}/file_meta_datas`, [["where", "type", "==", "file"], ["where", "path", "==", TARGET_DIRECTORY_WORK_DIR_PATH]])
    for(let file_info of QUERY_RESULT_FILE_INFOS)
      await Firebase_Service.delete_File(file_info.file_name, file_info.file_ext, TARGET_DIRECTORY_WORK_DIR_PATH, user_auth)
    
    await Firebase_Api.delete_From_Database(`app/${user_auth}/file_meta_datas`, [["where", "file_uuid", "==", TARGET_DIRECTORY_UUID]])
  }
}

export default Firebase_Service